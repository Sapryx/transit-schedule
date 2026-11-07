import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { apiServer } from "./testing/apiServer.ts";
import { renderApp } from "./testing/renderApp.tsx";

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
  },
];

const name = (ru: string, en: string) => ({ ru, en });
const volotova = name("Волотова", "Volotova");
const khram = name("Храм", "Khram");
const vokzal = name("Вокзал", "Vokzal");
const direction = (id: number, state: Partial<{ scheduled: boolean; needsReview: boolean; missingFromOsm: boolean }> = {}) => ({
  id,
  name: { from: vokzal, to: volotova, via: null },
  scheduled: false,
  needsReview: false,
  missingFromOsm: false,
  ...state,
});
const route = (id: number, number: string, mode: string, directions: ReturnType<typeof direction>[], state: Partial<{ withdrawn: boolean; missingFromOsm: boolean }> = {}) => ({
  id,
  number,
  mode,
  withdrawn: false,
  missingFromOsm: false,
  directions,
  ...state,
});

const routes = [
  route(1, "43", "bus", [direction(1, { scheduled: true }), direction(2, { scheduled: true })]),
  route(2, "2", "trolleybus", [direction(3)]),
  route(3, "15", "trolleybus", [direction(4, { scheduled: true, needsReview: true }), direction(5, { scheduled: true })]),
  route(4, "20", "bus", [direction(6, { missingFromOsm: true })], { missingFromOsm: true }),
  route(5, "10а", "bus", [direction(7, { scheduled: true })], { withdrawn: true }),
];

const platform = (platformId: number, stopName: typeof vokzal, travelOffset: number | null) => ({
  platformId,
  stopId: platformId,
  stopName,
  lat: 52.4,
  lon: 31,
  travelOffset,
  interpolated: false,
});

const routeDetail = {
  ...route(3, "15", "trolleybus", []),
  directions: [
    {
      ...direction(4, { scheduled: true, needsReview: true }),
      name: { from: volotova, to: vokzal, via: khram },
      platforms: [platform(10, volotova, 0), platform(11, khram, 4), platform(12, vokzal, 9)],
      departures: { weekday: [360], weekend: [] },
      path: [[52.4, 31], [52.41, 31.01]],
    },
    {
      ...direction(5),
      platforms: [platform(12, vokzal, null), platform(10, volotova, null)],
      departures: { weekday: [], weekend: [] },
      path: [],
    },
  ],
};

beforeEach(() => {
  localStorage.setItem("session", JSON.stringify({ token: "valid-token", expiresAt: "2999-01-01T00:00:00.000Z" }));
  apiServer.use(
    http.get("http://localhost/api/admin/routes", () => HttpResponse.json(routes)),
    http.get("http://localhost/api/admin/routes/3", () => HttpResponse.json(routeDetail)),
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

  it("shows each direction's platform sequence read-only with the OSM hint", async () => {
    renderApp({ language: text.language, path: "/routes/3" });

    expect(await screen.findByRole("heading", { name: text.routeHeading })).toBeInTheDocument();
    expect(screen.getByText(text.hint)).toBeInTheDocument();
    const first = screen.getByRole("table", { name: text.direction });
    expect(within(first).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["#", text.stop, text.travelOffset]);
    expect(within(first).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([`1${text.stops[0]}0`, `2${text.stops[1]}4`, `3${text.stops[2]}9`]);
    expect(within(screen.getByRole("region", { name: text.direction })).getByText(`${text.scheduled}, ${text.needsReview}`)).toBeInTheDocument();
    const second = screen.getByRole("table", { name: text.plainDirection });
    expect(within(second).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([`1${text.stops[2]}—`, `2${text.stops[0]}—`]);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("says when the route does not exist", async () => {
    renderApp({ language: text.language, path: "/routes/99" });

    expect(await screen.findByRole("alert")).toHaveTextContent(text.notFound);
  });
});
