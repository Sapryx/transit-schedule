import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { apiServer } from "./testing/apiServer.ts";
import { renderApp } from "./testing/renderApp.tsx";

const locales = [
  {
    language: "en",
    nav: "Stops",
    name: "Name",
    state: "State",
    missing: "Missing from OSM",
    inOsm: "In OSM",
    stops: ["Novaya", "Vokzal"],
    deleteStop: "Delete stop",
    confirmDelete: "Delete",
    inUse: "Directions still pass through this stop. Delete them first.",
    failed: "Something went wrong. Try again later.",
  },
  {
    language: "ru",
    nav: "Остановки",
    name: "Название",
    state: "Состояние",
    missing: "Пропала из OSM",
    inOsm: "Есть в OSM",
    stops: ["Новая", "Вокзал"],
    deleteStop: "Удалить остановку",
    confirmDelete: "Удалить",
    inUse: "Через остановку ещё проходят направления. Сначала удалите их.",
    failed: "Что-то пошло не так. Повторите попытку позже.",
  },
];

const stops = [
  { id: 1, name: { ru: "Новая", en: "Novaya" }, missingFromOsm: true },
  { id: 2, name: { ru: "Вокзал", en: "Vokzal" }, missingFromOsm: false },
];

beforeEach(() => {
  localStorage.setItem("session", JSON.stringify({ token: "valid-token", expiresAt: "2999-01-01T00:00:00.000Z" }));
  apiServer.use(http.get("http://localhost/api/admin/stops", () => HttpResponse.json(stops)));
});

describe.each(locales)("stops in $language", (text) => {
  it("lists stops with their state and offers deletion only for missing ones", async () => {
    const { user } = renderApp({ language: text.language });

    await user.click(screen.getByRole("link", { name: text.nav }));

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([text.name, text.state, ""]);
    const [missing, present] = within(table).getAllByRole("row").slice(1);
    expect(within(missing).getAllByRole("cell").slice(0, 2).map((cell) => cell.textContent)).toEqual([text.stops[0], text.missing]);
    expect(within(missing).getByRole("button", { name: text.deleteStop })).toBeInTheDocument();
    expect(within(present).getAllByRole("cell").slice(0, 2).map((cell) => cell.textContent)).toEqual([text.stops[1], text.inOsm]);
    expect(within(present).queryByRole("button")).not.toBeInTheDocument();
  });

  it("deletes a missing stop after confirmation", async () => {
    let deleted: string | null = null;
    apiServer.use(
      http.delete("http://localhost/api/admin/stops/:id", ({ params }) => {
        deleted = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderApp({ language: text.language, path: "/stops" });

    await user.click(await screen.findByRole("button", { name: text.deleteStop }));
    apiServer.use(http.get("http://localhost/api/admin/stops", () => HttpResponse.json(stops.slice(1))));
    await user.click(screen.getByRole("button", { name: text.confirmDelete }));

    expect(deleted).toBe("1");
    await waitFor(() => expect(screen.queryByText(text.stops[0])).not.toBeInTheDocument());
  });

  it("explains why a stop in use cannot be deleted", async () => {
    apiServer.use(http.delete("http://localhost/api/admin/stops/:id", () => HttpResponse.json({ error: "stop_in_use" }, { status: 409 })));
    const { user } = renderApp({ language: text.language, path: "/stops" });

    await user.click(await screen.findByRole("button", { name: text.deleteStop }));
    await user.click(screen.getByRole("button", { name: text.confirmDelete }));

    expect(await screen.findByRole("alert")).toHaveTextContent(text.inUse);
    expect(screen.getByText(text.stops[0])).toBeInTheDocument();
  });

  it("reports a failed load", async () => {
    apiServer.use(http.get("http://localhost/api/admin/stops", () => HttpResponse.json(null, { status: 500 })));
    renderApp({ language: text.language, path: "/stops" });

    expect(await screen.findByRole("alert")).toHaveTextContent(text.failed);
  });
});
