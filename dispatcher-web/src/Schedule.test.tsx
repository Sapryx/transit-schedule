import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { apiServer } from "./testing/apiServer.ts";
import { renderApp } from "./testing/renderApp.tsx";
import { routeDetail } from "./testing/routeFixtures.ts";

const locales = [
  {
    language: "en",
    direction: "Volotova → Vokzal via Khram",
    plainDirection: "Vokzal → Volotova",
    offsetAt: (stop: string) => `Travel offset at ${stop}`,
    saveOffsets: "Save travel offsets",
    saved: "Saved.",
    invalidOffsets: "Travel offsets must be whole minutes that never decrease.",
    dayType: "Day type",
    weekend: "Weekends",
    departures: "Departures",
    departureAt: (time: string) => `Departure ${time}`,
    remove: (time: string) => `Delete departure ${time}`,
    newDeparture: "New departure",
    add: "Add",
    from: "From",
    to: "To",
    every: "Every, min",
    addSeries: "Add series",
    invalidTime: "Enter a time as HH:MM; after midnight continue past 24:00, e.g. 24:20.",
    invalidSeries: "Enter a start, an end not earlier than the start and an interval of at least 1 minute.",
    duplicate: "This departure already exists.",
    trips: "Trips",
    noDepartures: "No departures.",
    failed: "Something went wrong. Try again later.",
    stops: ["Volotova", "Khram", "Vokzal"],
  },
  {
    language: "ru",
    direction: "Волотова → Вокзал через Храм",
    plainDirection: "Вокзал → Волотова",
    offsetAt: (stop: string) => `Время в пути до остановки ${stop}`,
    saveOffsets: "Сохранить время в пути",
    saved: "Сохранено.",
    invalidOffsets: "Время в пути — целые минуты, которые не убывают.",
    dayType: "Тип дня",
    weekend: "Выходные",
    departures: "Отправления",
    departureAt: (time: string) => `Отправление ${time}`,
    remove: (time: string) => `Удалить отправление ${time}`,
    newDeparture: "Новое отправление",
    add: "Добавить",
    from: "С",
    to: "До",
    every: "Каждые, мин",
    addSeries: "Добавить серию",
    invalidTime: "Введите время как ЧЧ:ММ; после полуночи продолжайте за 24:00, например 24:20.",
    invalidSeries: "Введите начало, конец не раньше начала и интервал не меньше 1 минуты.",
    duplicate: "Такое отправление уже есть.",
    trips: "Рейсы",
    noDepartures: "Отправлений нет.",
    failed: "Что-то пошло не так. Повторите попытку позже.",
    stops: ["Волотова", "Храм", "Вокзал"],
  },
];

type Detail = typeof routeDetail;
let stored: Detail;
let requests: { path: string; body: unknown }[];

beforeEach(() => {
  localStorage.setItem("session", JSON.stringify({ token: "valid-token", expiresAt: "2999-01-01T00:00:00.000Z" }));
  stored = structuredClone(routeDetail);
  requests = [];
  const directionOf = (id: string | readonly string[] | undefined) => stored.directions.find((direction) => direction.id === Number(id))!;
  apiServer.use(
    http.get("http://localhost/api/admin/routes/3", () => HttpResponse.json(stored)),
    http.put("http://localhost/api/admin/directions/:id/travel-offsets", async ({ request, params }) => {
      const body = (await request.json()) as number[];
      requests.push({ path: new URL(request.url).pathname, body });
      directionOf(params.id).platforms.forEach((platform, index) => (platform.travelOffset = body[index]));
      return new HttpResponse(null, { status: 204 });
    }),
    http.put("http://localhost/api/admin/directions/:id/departures", async ({ request, params }) => {
      const body = (await request.json()) as Detail["directions"][number]["departures"];
      requests.push({ path: new URL(request.url).pathname, body });
      directionOf(params.id).departures = body;
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

async function openDirection(language: string, name: string) {
  const rendered = renderApp({ language, path: "/routes/3" });
  const region = await screen.findByRole("region", { name });
  return { ...rendered, region: within(region) };
}

const listedDepartures = (region: ReturnType<typeof within>, name: string) =>
  within(region.getByRole("list", { name })).getAllByRole("textbox").map((input) => (input as HTMLInputElement).value);

describe.each(locales)("travel offsets in $language", (text) => {
  it("edits every offset after the first, which stays 0, and saves them in order", async () => {
    const { user, region } = await openDirection(text.language, text.plainDirection);
    expect(region.queryByRole("spinbutton", { name: text.offsetAt(text.stops[2]) })).not.toBeInTheDocument();

    await user.type(region.getByRole("spinbutton", { name: text.offsetAt(text.stops[0]) }), "12");
    await user.click(region.getByRole("button", { name: text.saveOffsets }));

    expect(await region.findByRole("status")).toHaveTextContent(text.saved);
    expect(requests).toEqual([{ path: "/api/admin/directions/5/travel-offsets", body: [0, 12] }]);
  });

  it.each([
    ["decreasing", "3"],
    ["fractional", "4.5"],
    ["empty", ""],
  ])("refuses %s offsets without saving", async (_, value) => {
    const { user, region } = await openDirection(text.language, text.direction);
    const khram = region.getByRole("spinbutton", { name: text.offsetAt(text.stops[1]) });
    await user.clear(khram);
    await user.type(khram, "10");
    const vokzal = region.getByRole("spinbutton", { name: text.offsetAt(text.stops[2]) });
    await user.clear(vokzal);
    if (value) {
      await user.type(vokzal, value);
    }

    await user.click(region.getByRole("button", { name: text.saveOffsets }));

    expect(region.getByRole("alert")).toHaveTextContent(text.invalidOffsets);
    expect(requests).toEqual([]);
  });

  it("shows the server's validation error", async () => {
    apiServer.use(http.put("http://localhost/api/admin/directions/:id/travel-offsets", () => HttpResponse.json({ error: "invalid_travel_offsets" }, { status: 422 })));
    const { user, region } = await openDirection(text.language, text.direction);

    await user.click(region.getByRole("button", { name: text.saveOffsets }));

    expect(await region.findByRole("alert")).toHaveTextContent(text.invalidOffsets);
  });
});

describe.each(locales)("departures in $language", (text) => {
  it("lists departures of the chosen day type", async () => {
    const { user, region } = await openDirection(text.language, text.direction);
    expect(listedDepartures(region, text.departures)).toEqual(["06:00"]);

    await user.selectOptions(region.getByRole("combobox", { name: text.dayType }), text.weekend);

    expect(region.getByText(text.noDepartures)).toBeInTheDocument();
  });

  it("adds a departure past midnight to the chosen day type, keeping the list ordered", async () => {
    const { user, region } = await openDirection(text.language, text.direction);

    await user.type(region.getByRole("textbox", { name: text.newDeparture }), "24:20");
    await user.click(region.getByRole("button", { name: text.add }));
    await user.type(region.getByRole("textbox", { name: text.newDeparture }), "05:30");
    await user.click(region.getByRole("button", { name: text.add }));

    expect(await region.findByDisplayValue("05:30")).toBeInTheDocument();
    expect(listedDepartures(region, text.departures)).toEqual(["05:30", "06:00", "24:20"]);
    expect(requests.at(-1)).toEqual({ path: "/api/admin/directions/4/departures", body: { weekday: [330, 360, 1460], weekend: [] } });
    expect(region.getByRole("status")).toHaveTextContent(text.saved);
  });

  it("edits a departure", async () => {
    const { user, region } = await openDirection(text.language, text.direction);
    const departure = region.getByRole("textbox", { name: text.departureAt("06:00") });

    await user.clear(departure);
    await user.type(departure, "06:10{Enter}");

    expect(await region.findByRole("textbox", { name: text.departureAt("06:10") })).toBeInTheDocument();
    expect(requests).toEqual([{ path: "/api/admin/directions/4/departures", body: { weekday: [370], weekend: [] } }]);
  });

  it("refuses to add or edit a departure into an existing one", async () => {
    stored.directions[0].departures = { weekday: [360, 400], weekend: [] };
    const { user, region } = await openDirection(text.language, text.direction);

    await user.type(region.getByRole("textbox", { name: text.newDeparture }), "06:00");
    await user.click(region.getByRole("button", { name: text.add }));
    expect(region.getByRole("alert")).toHaveTextContent(text.duplicate);

    const departure = region.getByRole("textbox", { name: text.departureAt("06:40") });
    await user.clear(departure);
    await user.type(departure, "06:00{Enter}");

    expect(region.getByRole("alert")).toHaveTextContent(text.duplicate);
    expect(requests).toEqual([]);
  });

  it("deletes a departure", async () => {
    const { user, region } = await openDirection(text.language, text.direction);

    await user.click(region.getByRole("button", { name: text.remove("06:00") }));

    expect(await region.findByText(text.noDepartures)).toBeInTheDocument();
    expect(requests).toEqual([{ path: "/api/admin/directions/4/departures", body: { weekday: [], weekend: [] } }]);
  });

  it("adds a series every N minutes to weekends", async () => {
    const { user, region } = await openDirection(text.language, text.direction);
    await user.selectOptions(region.getByRole("combobox", { name: text.dayType }), text.weekend);

    await user.type(region.getByRole("textbox", { name: text.from }), "23:30");
    await user.type(region.getByRole("textbox", { name: text.to }), "24:30");
    await user.type(region.getByRole("spinbutton", { name: text.every }), "20");
    await user.click(region.getByRole("button", { name: text.addSeries }));

    expect(await region.findByDisplayValue("24:30")).toBeInTheDocument();
    expect(listedDepartures(region, text.departures)).toEqual(["23:30", "23:50", "24:10", "24:30"]);
    expect(requests).toEqual([{ path: "/api/admin/directions/4/departures", body: { weekday: [360], weekend: [1410, 1430, 1450, 1470] } }]);
  });

  it.each(["6.00", "48:00", "06:60"])("refuses the time %s", async (time) => {
    const { user, region } = await openDirection(text.language, text.direction);

    await user.type(region.getByRole("textbox", { name: text.newDeparture }), time);
    await user.click(region.getByRole("button", { name: text.add }));

    expect(region.getByRole("alert")).toHaveTextContent(text.invalidTime);
    expect(requests).toEqual([]);
  });

  it.each([
    ["an end before the start", "08:00", "07:00", "10"],
    ["a zero interval", "07:00", "08:00", "0"],
  ])("refuses a series with %s", async (_, from, to, every) => {
    const { user, region } = await openDirection(text.language, text.direction);

    await user.type(region.getByRole("textbox", { name: text.from }), from);
    await user.type(region.getByRole("textbox", { name: text.to }), to);
    await user.type(region.getByRole("spinbutton", { name: text.every }), every);
    await user.click(region.getByRole("button", { name: text.addSeries }));

    expect(region.getByRole("alert")).toHaveTextContent(text.invalidSeries);
    expect(requests).toEqual([]);
  });

  it("reports a failed save", async () => {
    apiServer.use(http.put("http://localhost/api/admin/directions/:id/departures", () => HttpResponse.json(null, { status: 500 })));
    const { user, region } = await openDirection(text.language, text.direction);

    await user.click(region.getByRole("button", { name: text.remove("06:00") }));

    expect(await region.findByRole("alert")).toHaveTextContent(text.failed);
  });
});

describe.each(locales)("trip table in $language", (text) => {
  it("shows arrival times at every platform for each departure of the chosen day type", async () => {
    stored.directions[0].departures = { weekday: [360, 1430], weekend: [480] };
    const { user, region } = await openDirection(text.language, text.direction);

    const trips = () => region.getByRole("table", { name: text.trips });
    const rows = () => within(trips()).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent));
    expect(rows()).toEqual([
      [text.stops[0], "06:00", "23:50"],
      [text.stops[1], "06:04", "23:54"],
      [text.stops[2], "06:09", "23:59"],
    ]);

    await user.selectOptions(region.getByRole("combobox", { name: text.dayType }), text.weekend);

    expect(rows()).toEqual([
      [text.stops[0], "08:00"],
      [text.stops[1], "08:04"],
      [text.stops[2], "08:09"],
    ]);
  });

  it("marks arrivals at platforms without an offset", async () => {
    stored.directions[1].departures = { weekday: [1440], weekend: [] };
    const { region } = await openDirection(text.language, text.plainDirection);

    const rows = within(region.getByRole("table", { name: text.trips })).getAllByRole("row");

    expect(rows.slice(1).map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([
      [text.stops[2], "24:00"],
      [text.stops[0], "—"],
    ]);
  });
});
