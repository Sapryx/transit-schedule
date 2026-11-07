import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { apiServer } from "./testing/apiServer.ts";
import { renderApp } from "./testing/renderApp.tsx";

const locales = [
  {
    language: "en",
    nav: "Sync with OSM",
    heading: "Sync with OSM",
    start: "Start sync",
    running: "Sync is running…",
    kind: "Object",
    stops: "Stops",
    routes: "Routes",
    created: "Created",
    updated: "Updated",
    missing: "Missing from OSM",
    needsReview: "Directions needing review",
    noReview: "No directions need review.",
    skipped: "Skipped routes",
    regional: "671: regional route",
    noRef: "No number: route without a number",
    inProgress: "Another sync is already running. Wait for it to finish.",
    unavailable: "OpenStreetMap is unavailable. Try again later.",
    failed: "Something went wrong. Try again later.",
  },
  {
    language: "ru",
    nav: "Синхронизация с OSM",
    heading: "Синхронизация с OSM",
    start: "Запустить синхронизацию",
    running: "Идёт синхронизация…",
    kind: "Объект",
    stops: "Остановки",
    routes: "Маршруты",
    created: "Создано",
    updated: "Обновлено",
    missing: "Пропало из OSM",
    needsReview: "Направления на проверку",
    noReview: "Направлений на проверку нет.",
    skipped: "Пропущенные маршруты",
    regional: "671: пригородный маршрут",
    noRef: "Без номера: маршрут без номера",
    inProgress: "Синхронизация уже идёт. Дождитесь её окончания.",
    unavailable: "OpenStreetMap недоступен. Повторите попытку позже.",
    failed: "Что-то пошло не так. Повторите попытку позже.",
  },
];

const url = "http://localhost/api/admin/osm-sync";
const report = {
  stops: { created: 124, updated: 2, missing: 1 },
  platforms: { created: 125, updated: 0, missing: 0 },
  routes: { created: 4, updated: 0, missing: 3 },
  directions: { created: 8, updated: 1, missing: 0 },
  needsReview: [17, 42],
  skippedRoutes: [
    { ref: "671", reason: "regional" },
    { ref: null, reason: "no_ref" },
  ],
};

beforeEach(() => {
  localStorage.setItem("session", JSON.stringify({ token: "valid-token", expiresAt: "2999-01-01T00:00:00.000Z" }));
  apiServer.use(http.post(url, () => HttpResponse.json(report)));
});

describe.each(locales)("OSM sync page in $language", (text) => {
  it("is reached from the navigation", async () => {
    const { user } = renderApp({ language: text.language });

    await user.click(screen.getByRole("link", { name: text.nav }));

    expect(screen.getByRole("heading", { name: text.heading })).toBeInTheDocument();
  });

  it("shows progress and disables the button while the sync runs", async () => {
    let finish = () => {};
    apiServer.use(http.post(url, () => new Promise<Response>((resolve) => (finish = () => resolve(HttpResponse.json(report))))));
    const { user } = renderApp({ language: text.language, path: "/osm-sync" });

    await user.click(screen.getByRole("button", { name: text.start }));

    expect(await screen.findByRole("status")).toHaveTextContent(text.running);
    expect(screen.getByRole("button", { name: text.start })).toBeDisabled();
    finish();
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.start })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the report", async () => {
    const { user } = renderApp({ language: text.language, path: "/osm-sync" });

    await user.click(screen.getByRole("button", { name: text.start }));

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([text.kind, text.created, text.updated, text.missing]);
    expect(within(table).getByRole("row", { name: `${text.stops} 124 2 1` })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: `${text.routes} 4 0 3` })).toBeInTheDocument();
    const review = screen.getByRole("list", { name: text.needsReview });
    expect(within(review).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["17", "42"]);
    const skipped = screen.getByRole("list", { name: text.skipped });
    expect(within(skipped).getAllByRole("listitem").map((item) => item.textContent)).toEqual([text.regional, text.noRef]);
  });

  it("says when no direction needs review", async () => {
    apiServer.use(http.post(url, () => HttpResponse.json({ ...report, needsReview: [] })));
    const { user } = renderApp({ language: text.language, path: "/osm-sync" });

    await user.click(screen.getByRole("button", { name: text.start }));

    expect(await screen.findByText(text.noReview)).toBeInTheDocument();
  });

  it("hides the previous report when a later sync fails", async () => {
    const { user } = renderApp({ language: text.language, path: "/osm-sync" });
    await user.click(screen.getByRole("button", { name: text.start }));
    await screen.findByRole("table");
    apiServer.use(http.post(url, () => HttpResponse.json({ error: "overpass_unavailable" }, { status: 502 })));

    await user.click(screen.getByRole("button", { name: text.start }));

    expect(await screen.findByRole("alert")).toHaveTextContent(text.unavailable);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it.each([
    { status: 409, error: "sync_in_progress", message: "inProgress" as const },
    { status: 502, error: "overpass_unavailable", message: "unavailable" as const },
    { status: 500, error: undefined, message: "failed" as const },
  ])("reports a $status response", async ({ status, error, message }) => {
    apiServer.use(http.post(url, () => HttpResponse.json(error ? { error } : null, { status })));
    const { user } = renderApp({ language: text.language, path: "/osm-sync" });

    await user.click(screen.getByRole("button", { name: text.start }));

    expect(await screen.findByRole("alert")).toHaveTextContent(text[message]);
    expect(screen.getByRole("button", { name: text.start })).toBeEnabled();
  });
});
