import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { apiServer } from "./testing/apiServer.ts";
import { renderApp } from "./testing/renderApp.tsx";

const locales = [
  {
    language: "en",
    nav: "Holidays",
    heading: "Holidays",
    showPast: "Show past holidays",
    date: "Date",
    add: "Add",
    remove: "Remove",
    upcoming: "December 25, 2026",
    past: "January 1, 2026",
    added: "November 10, 2026",
    empty: "No holidays.",
    duplicate: "This date is already a holiday.",
    invalid: "Enter a valid date.",
    failed: "Something went wrong. Try again later.",
  },
  {
    language: "ru",
    nav: "Праздники",
    heading: "Праздники",
    showPast: "Показывать прошедшие",
    date: "Дата",
    add: "Добавить",
    remove: "Удалить",
    upcoming: "25 декабря 2026 г.",
    past: "1 января 2026 г.",
    added: "10 ноября 2026 г.",
    empty: "Праздников нет.",
    duplicate: "Эта дата уже отмечена как праздник.",
    invalid: "Введите корректную дату.",
    failed: "Что-то пошло не так. Повторите попытку позже.",
  },
];

const base = "http://localhost/api/admin/holidays";
let holidays: { date: string; past: boolean }[];

beforeEach(() => {
  localStorage.setItem("session", JSON.stringify({ token: "valid-token", expiresAt: "2999-01-01T00:00:00.000Z" }));
  holidays = [
    { date: "2026-01-01", past: true },
    { date: "2026-12-25", past: false },
  ];
  apiServer.use(
    http.get(base, ({ request }) => {
      const includePast = new URL(request.url).searchParams.get("past") === "true";
      return HttpResponse.json(holidays.filter((h) => includePast || !h.past).map(({ date }) => ({ date })));
    }),
    http.post(base, async ({ request }) => {
      const { date } = (await request.json()) as { date: string };
      if (holidays.some((h) => h.date === date)) {
        return HttpResponse.json({ error: "duplicate_date" }, { status: 409 });
      }
      holidays = [...holidays, { date, past: false }].sort((a, b) => a.date.localeCompare(b.date));
      return HttpResponse.json({ date }, { status: 201 });
    }),
    http.delete(`${base}/:date`, ({ params }) => {
      holidays = holidays.filter((h) => h.date !== params.date);
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

describe.each(locales)("holidays page in $language", (text) => {
  it("is reached from the navigation and lists upcoming holidays", async () => {
    const { user } = renderApp({ language: text.language });

    await user.click(screen.getByRole("link", { name: text.nav }));

    expect(screen.getByRole("heading", { name: text.heading })).toBeInTheDocument();
    expect(await screen.findByText(text.upcoming)).toBeInTheDocument();
    expect(screen.queryByText(text.past)).not.toBeInTheDocument();
  });

  it("shows past holidays on request", async () => {
    const { user } = renderApp({ language: text.language, path: "/holidays" });
    await screen.findByText(text.upcoming);

    await user.click(screen.getByLabelText(text.showPast));

    expect(await screen.findByText(text.past)).toBeInTheDocument();
  });

  it("adds a holiday", async () => {
    const { user } = renderApp({ language: text.language, path: "/holidays" });
    await screen.findByText(text.upcoming);

    await user.type(screen.getByLabelText(text.date), "2026-11-10");
    await user.click(screen.getByRole("button", { name: text.add }));

    expect(await screen.findByText(text.added)).toBeInTheDocument();
    expect(screen.getByLabelText(text.date)).toHaveValue("");
  });

  it("reports a duplicate holiday", async () => {
    const { user } = renderApp({ language: text.language, path: "/holidays" });
    await screen.findByText(text.upcoming);

    await user.type(screen.getByLabelText(text.date), "2026-12-25");
    await user.click(screen.getByRole("button", { name: text.add }));

    expect(await screen.findByRole("alert")).toHaveTextContent(text.duplicate);
  });

  it("reports an invalid date", async () => {
    apiServer.use(http.post(base, () => HttpResponse.json({ error: "invalid_date" }, { status: 422 })));
    const { user } = renderApp({ language: text.language, path: "/holidays" });
    await screen.findByText(text.upcoming);

    await user.type(screen.getByLabelText(text.date), "2026-11-10");
    await user.click(screen.getByRole("button", { name: text.add }));

    expect(await screen.findByRole("alert")).toHaveTextContent(text.invalid);
  });

  it("reports a server failure", async () => {
    apiServer.use(http.get(base, () => new HttpResponse(null, { status: 500 })));
    renderApp({ language: text.language, path: "/holidays" });

    expect(await screen.findByRole("alert")).toHaveTextContent(text.failed);
  });

  it("removes a holiday", async () => {
    const { user } = renderApp({ language: text.language, path: "/holidays" });
    const row = (await screen.findByText(text.upcoming)).closest("li")!;

    await user.click(within(row).getByRole("button", { name: text.remove }));

    expect(await screen.findByText(text.empty)).toBeInTheDocument();
  });
});
