import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { apiServer } from "./testing/apiServer.ts";
import { renderApp } from "./testing/renderApp.tsx";
import { missingRouteDetail, routeDetail, routes } from "./testing/routeFixtures.ts";

const locales = [
  {
    language: "en",
    nav: "Routes",
    heading: "Routes",
    mode: "Mode",
    state: "State",
    search: "Number",
    all: "All",
    bus: "Bus",
    trolleybus: "Trolleybus",
    scheduled: "Scheduled",
    unscheduled: "Unscheduled",
    needsReview: "Needs review",
    withdrawn: "Withdrawn",
    missing: "Missing from OSM",
    empty: "No routes match.",
    routeHeading: "Trolleybus 15",
    direction: "Volotova → Vokzal via Khram",
    plainDirection: "Vokzal → Volotova",
    stop: "Stop",
    travelOffset: "Travel offset, min",
    hint: "Stops, platform sequences and paths come from OpenStreetMap and cannot be changed here. Correct them in OpenStreetMap and run a sync.",
    notFound: "Route not found.",
    failed: "Something went wrong. Try again later.",
    stops: ["Volotova", "Khram", "Vokzal"],
    interpolated: "interpolated",
    review: "The last sync changed this platform sequence. Check the highlighted travel offsets: they were interpolated.",
    confirmReview: "Confirm review",
    withdrawnToggle: "Withdrawn from service",
    deleteRoute: "Delete route",
    deleteDirection: "Delete direction",
    deleteQuestion: "Delete permanently? This cannot be undone.",
    confirmDelete: "Delete",
    cancel: "Cancel",
    notMissing: "Only objects missing from OSM can be deleted.",
  },
  {
    language: "ru",
    nav: "Маршруты",
    heading: "Маршруты",
    mode: "Вид транспорта",
    state: "Состояние",
    search: "Номер",
    all: "Все",
    bus: "Автобус",
    trolleybus: "Троллейбус",
    scheduled: "С расписанием",
    unscheduled: "Без расписания",
    needsReview: "На проверку",
    withdrawn: "Снят с линии",
    missing: "Пропал из OSM",
    empty: "Подходящих маршрутов нет.",
    routeHeading: "Троллейбус 15",
    direction: "Волотова → Вокзал через Храм",
    plainDirection: "Вокзал → Волотова",
    stop: "Остановка",
    travelOffset: "Время в пути, мин",
    hint: "Остановки, последовательности платформ и пути берутся из OpenStreetMap и здесь не меняются. Исправьте их в OpenStreetMap и запустите синхронизацию.",
    notFound: "Маршрут не найден.",
    failed: "Что-то пошло не так. Повторите попытку позже.",
    stops: ["Волотова", "Храм", "Вокзал"],
    interpolated: "интерполировано",
    review: "Последняя синхронизация изменила последовательность платформ. Проверьте выделенное время в пути: оно интерполировано.",
    confirmReview: "Подтвердить проверку",
    withdrawnToggle: "Снят с линии",
    deleteRoute: "Удалить маршрут",
    deleteDirection: "Удалить направление",
    deleteQuestion: "Удалить безвозвратно? Отменить это нельзя.",
    confirmDelete: "Удалить",
    cancel: "Отмена",
    notMissing: "Удалить можно только то, что пропало из OSM.",
  },
];

beforeEach(() => {
  localStorage.setItem("session", JSON.stringify({ token: "valid-token", expiresAt: "2999-01-01T00:00:00.000Z" }));
  apiServer.use(
    http.get("http://localhost/api/admin/routes", () => HttpResponse.json(routes)),
    http.get("http://localhost/api/admin/routes/3", () => HttpResponse.json(routeDetail)),
    http.get("http://localhost/api/admin/routes/4", () => HttpResponse.json(missingRouteDetail)),
    http.get("http://localhost/api/admin/routes/99", () => HttpResponse.json({ error: "not_found" }, { status: 404 })),
  );
});

function routeNumbers() {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);
}

describe.each(locales)("route list in $language", (text) => {
  it("is reached from the navigation and lists routes in natural number order", async () => {
    const { user } = renderApp({ language: text.language });

    await user.click(screen.getByRole("link", { name: text.nav }));

    expect(screen.getByRole("heading", { name: text.heading })).toBeInTheDocument();
    await screen.findByRole("table");
    expect(routeNumbers()).toEqual(["2", "10а", "15", "20", "43"]);
  });

  it("shows each route's mode and state", async () => {
    renderApp({ language: text.language, path: "/routes" });

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([text.search, text.mode, text.state]);
    expect(within(table).getByRole("row", { name: `43 ${text.bus} ${text.scheduled}` })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: `2 ${text.trolleybus} ${text.unscheduled}` })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: `15 ${text.trolleybus} ${text.scheduled}, ${text.needsReview}` })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: `20 ${text.bus} ${text.unscheduled}, ${text.missing}` })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: `10а ${text.bus} ${text.scheduled}, ${text.withdrawn}` })).toBeInTheDocument();
  });

  it("filters by mode", async () => {
    const { user } = renderApp({ language: text.language, path: "/routes" });
    await screen.findByRole("table");

    await user.selectOptions(screen.getByRole("combobox", { name: text.mode }), text.trolleybus);

    expect(routeNumbers()).toEqual(["2", "15"]);
  });

  it.each([
    { state: "unscheduled" as const, numbers: ["2", "20"] },
    { state: "needsReview" as const, numbers: ["15"] },
    { state: "withdrawn" as const, numbers: ["10а"] },
    { state: "missing" as const, numbers: ["20"] },
    { state: "scheduled" as const, numbers: ["10а", "15", "43"] },
  ])("filters by state $state", async ({ state, numbers }) => {
    const { user } = renderApp({ language: text.language, path: "/routes" });
    await screen.findByRole("table");

    await user.selectOptions(screen.getByRole("combobox", { name: text.state }), text[state]);

    expect(routeNumbers()).toEqual(numbers);
  });

  it("searches by number and says when nothing matches", async () => {
    const { user } = renderApp({ language: text.language, path: "/routes" });
    await screen.findByRole("table");

    await user.type(screen.getByRole("searchbox", { name: text.search }), "1");
    expect(routeNumbers()).toEqual(["10а", "15"]);

    await user.type(screen.getByRole("searchbox", { name: text.search }), "9");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(text.empty)).toBeInTheDocument();
  });

  it("reports a failed load", async () => {
    apiServer.use(http.get("http://localhost/api/admin/routes", () => HttpResponse.json(null, { status: 500 })));
    renderApp({ language: text.language, path: "/routes" });

    expect(await screen.findByRole("alert")).toHaveTextContent(text.failed);
  });
});

describe.each(locales)("route page in $language", (text) => {
  it("opens from the route list", async () => {
    const { user } = renderApp({ language: text.language, path: "/routes" });

    await user.click(await screen.findByRole("link", { name: "15" }));

    expect(await screen.findByRole("heading", { name: text.routeHeading })).toBeInTheDocument();
  });

  it("shows each direction's platform sequence with its travel offsets and the OSM hint", async () => {
    renderApp({ language: text.language, path: "/routes/3" });

    expect(await screen.findByRole("heading", { name: text.routeHeading })).toBeInTheDocument();
    expect(screen.getByText(text.hint)).toBeInTheDocument();
    const offsets = (table: HTMLElement) =>
      within(table).getAllByRole("row").slice(1).map((row) => [row.textContent, within(row).queryByRole("spinbutton")?.getAttribute("value") ?? null]);
    const first = screen.getByRole("table", { name: text.direction });
    expect(within(first).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["#", text.stop, text.travelOffset]);
    expect(offsets(first)).toEqual([[`1${text.stops[0]}0`, null], [`2${text.stops[1]} ${text.interpolated}`, "4"], [`3${text.stops[2]}`, "9"]]);
    expect(within(screen.getByRole("region", { name: text.direction })).getByText(`${text.scheduled}, ${text.needsReview}`)).toBeInTheDocument();
    const second = screen.getByRole("table", { name: text.plainDirection });
    expect(offsets(second)).toEqual([[`1${text.stops[2]}0`, null], [`2${text.stops[0]}`, ""]]);
  });

  it("says when the route does not exist", async () => {
    renderApp({ language: text.language, path: "/routes/99" });

    expect(await screen.findByRole("alert")).toHaveTextContent(text.notFound);
  });
});

describe.each(locales)("route maintenance in $language", (text) => {
  it("shows the review banner with interpolated platforms highlighted and confirms the review", async () => {
    let reviewed: string | null = null;
    apiServer.use(
      http.post("http://localhost/api/admin/directions/:id/review", ({ params }) => {
        reviewed = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp({ language: text.language, path: "/routes/3" });

    const region = await screen.findByRole("region", { name: text.direction });
    expect(within(region).getByText(text.review)).toBeInTheDocument();
    const rows = within(within(region).getByRole("table", { name: text.direction })).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.querySelector("mark")?.textContent ?? null)).toEqual([null, text.interpolated, null]);
    expect(within(screen.getByRole("region", { name: text.plainDirection })).queryByRole("button", { name: text.confirmReview })).not.toBeInTheDocument();

    apiServer.use(
      http.get("http://localhost/api/admin/routes/3", () =>
        HttpResponse.json({ ...routeDetail, directions: [{ ...routeDetail.directions[0], needsReview: false }, routeDetail.directions[1]] }),
      ),
    );
    await user.click(within(region).getByRole("button", { name: text.confirmReview }));

    expect(reviewed).toBe("4");
    await waitFor(() => expect(within(region).queryByText(text.review)).not.toBeInTheDocument());
  });

  it("withdraws the route and returns it to service", async () => {
    const sent: unknown[] = [];
    let withdrawn = false;
    apiServer.use(
      http.patch("http://localhost/api/admin/routes/3", async ({ request }) => {
        const body = (await request.json()) as { withdrawn: boolean };
        sent.push(body);
        withdrawn = body.withdrawn;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get("http://localhost/api/admin/routes/3", () => HttpResponse.json({ ...routeDetail, withdrawn })),
    );
    const { user } = renderApp({ language: text.language, path: "/routes/3" });

    const toggle = await screen.findByRole("checkbox", { name: text.withdrawnToggle });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    await user.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());

    expect(sent).toEqual([{ withdrawn: true }, { withdrawn: false }]);
  });

  it("offers deletion only for objects missing from OSM", async () => {
    renderApp({ language: text.language, path: "/routes/3" });

    await screen.findByRole("heading", { name: text.routeHeading });
    expect(screen.queryByRole("button", { name: text.deleteRoute })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text.deleteDirection })).not.toBeInTheDocument();
  });

  it("deletes a missing direction after confirmation", async () => {
    let deleted: string | null = null;
    apiServer.use(
      http.delete("http://localhost/api/admin/directions/:id", ({ params }) => {
        deleted = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp({ language: text.language, path: "/routes/4" });

    await user.click(await screen.findByRole("button", { name: text.deleteDirection }));
    expect(screen.getByText(text.deleteQuestion)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: text.cancel }));
    expect(screen.queryByText(text.deleteQuestion)).not.toBeInTheDocument();
    expect(deleted).toBeNull();

    apiServer.use(http.get("http://localhost/api/admin/routes/4", () => HttpResponse.json({ ...missingRouteDetail, directions: [] })));
    await user.click(screen.getByRole("button", { name: text.deleteDirection }));
    await user.click(screen.getByRole("button", { name: text.confirmDelete }));

    expect(deleted).toBe("6");
    await waitFor(() => expect(screen.queryByRole("table")).not.toBeInTheDocument());
  });

  it("deletes a missing route after confirmation and returns to the route list", async () => {
    let deleted = false;
    apiServer.use(
      http.delete("http://localhost/api/admin/routes/4", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp({ language: text.language, path: "/routes/4" });

    await user.click(await screen.findByRole("button", { name: text.deleteRoute }));
    await user.click(screen.getByRole("button", { name: text.confirmDelete }));

    expect(await screen.findByRole("heading", { name: text.heading })).toBeInTheDocument();
    expect(deleted).toBe(true);
  });

  it("reports a refused deletion", async () => {
    apiServer.use(http.delete("http://localhost/api/admin/routes/4", () => HttpResponse.json({ error: "not_missing_from_osm" }, { status: 409 })));
    const { user } = renderApp({ language: text.language, path: "/routes/4" });

    await user.click(await screen.findByRole("button", { name: text.deleteRoute }));
    await user.click(screen.getByRole("button", { name: text.confirmDelete }));

    expect(await screen.findByRole("alert")).toHaveTextContent(text.notMissing);
  });
});
