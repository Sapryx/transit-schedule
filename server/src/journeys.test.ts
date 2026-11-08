import { asValue } from "awilix";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { DirectionDetail, RouteSummary } from "./networkAdmin.ts";
import { overpassFixture } from "./testing/overpassFixture.ts";
import { useTestServer } from "./testing/testServer.ts";

const univermag = "Универмаг «Гомель»";
const vokzal = "Вокзал";
const belgut = "БелГУТ";

describe("GET /api/journeys", () => {
  const server = useTestServer();
  let token: string;
  let now: Date;

  beforeEach(async () => {
    now = new Date("2026-11-09T05:00:00.000Z");
    server.container.register({ osmSource: asValue({ fetchElements: overpassFixture }), clock: asValue({ now: () => now }) });
    const login = await request(app()).post("/api/auth/login").send({ login: "dispatcher", password: "secret" });
    token = login.body.token;
    await admin("post", "/api/admin/osm-sync");
  });

  const app = () => server.container.cradle.app;
  const admin = (method: "get" | "post" | "put", path: string, body?: object) =>
    request(app())[method](path).set("Authorization", `Bearer ${token}`).send(body);

  async function direction(number: string, from: string, to: string): Promise<DirectionDetail & { routeId: number }> {
    const routes: RouteSummary[] = (await admin("get", "/api/admin/routes")).body;
    for (const { id } of routes.filter((route) => route.number === number)) {
      const route: RouteSummary<DirectionDetail> = (await admin("get", `/api/admin/routes/${id}`)).body;
      const found = route.directions.find((candidate) => {
        const names = candidate.platforms.map((platform) => platform.stopName.ru);
        return names.includes(from) && names.lastIndexOf(to) > names.indexOf(from);
      });
      if (found) {
        return { ...found, routeId: id };
      }
    }
    throw new Error(`no direction of ${number} from ${from} to ${to}`);
  }

  async function schedule(detail: DirectionDetail, departures: { weekday?: number[]; weekend?: number[] }, step = 2) {
    await admin("put", `/api/admin/directions/${detail.id}/travel-offsets`, detail.platforms.map((_, position) => position * step));
    await admin("put", `/api/admin/directions/${detail.id}/departures`, { weekday: [], weekend: [], ...departures });
  }

  const offsetAt = (detail: DirectionDetail, name: string, step = 2) => detail.platforms.findIndex((platform) => platform.stopName.ru === name) * step;
  const stopId = (detail: DirectionDetail, name: string) => detail.platforms.find((platform) => platform.stopName.ru === name)!.stopId;

  const minsk = (date: string, minutes: number) => {
    const time = new Date(Date.parse(`${date}T00:00:00+03:00`) + minutes * 60_000 + 3 * 3_600_000);
    return `${time.toISOString().slice(0, 19)}+03:00`;
  };

  const journeys = (from: number, to: number, at?: string, language?: string) => {
    const call = request(app()).get("/api/journeys").query({ from, to, ...(at && { at }) });
    return language ? call.set("Accept-Language", language) : call;
  };

  const departures = (body: { departure: string }[]) => body.map((journey) => journey.departure);

  it("returns a direct journey with its leg", async () => {
    const route20 = await direction("20", univermag, vokzal);
    await schedule(route20, { weekday: [480] });
    const from = stopId(route20, univermag);
    const to = stopId(route20, vokzal);

    const response = await journeys(from, to, "2026-11-09T08:00:00+03:00", "en");

    const departure = minsk("2026-11-09", 480 + offsetAt(route20, univermag));
    const arrival = minsk("2026-11-09", 480 + offsetAt(route20, vokzal));
    expect(response.status).toBe(200);
    expect(response.headers["content-language"]).toBe("en");
    expect(response.body).toEqual([
      {
        departure,
        arrival,
        transfers: 0,
        legs: [
          {
            routeId: route20.routeId,
            number: "20",
            mode: "bus",
            directionId: route20.id,
            directionName: `${route20.name.from.en} → ${route20.name.to.en}`,
            fromStop: { id: from, name: "Univermag «Gomel»" },
            toStop: { id: to, name: "Vokzal" },
            departure,
            arrival,
          },
        ],
      },
    ]);
  });

  it("names stops and directions in Russian when asked", async () => {
    const route20 = await direction("20", univermag, vokzal);
    await schedule(route20, { weekday: [480] });

    const response = await journeys(stopId(route20, univermag), stopId(route20, vokzal), undefined, "ru");

    const [leg] = response.body[0].legs;
    expect(response.headers["content-language"]).toBe("ru");
    expect(leg.directionName).toBe(`${route20.name.from.ru} → ${route20.name.to.ru}`);
    expect([leg.fromStop.name, leg.toStop.name]).toEqual([univermag, vokzal]);
  });

  it("starts from the clock's now by default", async () => {
    const route20 = await direction("20", univermag, vokzal);
    const boarding = offsetAt(route20, univermag);
    await schedule(route20, { weekday: [479 - boarding, 480 - boarding] });

    const response = await journeys(stopId(route20, univermag), stopId(route20, vokzal));

    expect(departures(response.body)).toEqual([minsk("2026-11-09", 480)]);
  });

  it("offers journeys starting within two hours", async () => {
    const route20 = await direction("20", univermag, vokzal);
    const boarding = offsetAt(route20, univermag);
    await schedule(route20, { weekday: [470, 480, 600, 601].map((minutes) => minutes - boarding) });

    const response = await journeys(stopId(route20, univermag), stopId(route20, vokzal), "2026-11-09T08:00:00+03:00");

    expect(departures(response.body)).toEqual([minsk("2026-11-09", 480), minsk("2026-11-09", 600)]);
  });

  it("offers up to five journeys sorted by departure", async () => {
    const route20 = await direction("20", univermag, vokzal);
    const boarding = offsetAt(route20, univermag);
    await schedule(route20, { weekday: [530, 520, 510, 500, 490, 480].map((minutes) => minutes - boarding) });

    const response = await journeys(stopId(route20, univermag), stopId(route20, vokzal), "2026-11-09T08:00:00+03:00");

    expect(departures(response.body)).toEqual([480, 490, 500, 510, 520].map((minutes) => minsk("2026-11-09", minutes)));
  });

  it("hides a journey that leaves earlier and arrives later than another one", async () => {
    const route20 = await direction("20", univermag, belgut);
    const route43 = await direction("43", univermag, belgut);
    await schedule(route20, { weekday: [480 - offsetAt(route20, univermag)] });
    await schedule(route43, { weekday: [470 - offsetAt(route43, univermag, 20), 490 - offsetAt(route43, univermag, 20)] }, 20);

    const response = await journeys(stopId(route20, univermag), stopId(route20, belgut), "2026-11-09T07:30:00+03:00");

    expect(response.body.map((journey: { legs: { number: string }[] }) => journey.legs[0].number)).toEqual(["20", "43"]);
    expect(departures(response.body)).toEqual([minsk("2026-11-09", 480), minsk("2026-11-09", 490)]);
  });

  it("travels only along the direction's order of stops", async () => {
    const route20 = await direction("20", univermag, vokzal);
    await schedule(route20, { weekday: [480] });

    const response = await journeys(stopId(route20, vokzal), stopId(route20, univermag), "2026-11-09T08:00:00+03:00");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each([
    ["a weekend", "2026-11-14"],
    ["a holiday", "2026-11-10"],
  ])("uses weekend departures on %s", async (_, date) => {
    await admin("post", "/api/admin/holidays", { date: "2026-11-10" });
    const route20 = await direction("20", univermag, vokzal);
    const boarding = offsetAt(route20, univermag);
    await schedule(route20, { weekday: [500 - boarding], weekend: [520 - boarding] });

    const response = await journeys(stopId(route20, univermag), stopId(route20, vokzal), `${date}T08:00:00+03:00`);

    expect(departures(response.body)).toEqual([minsk(date, 520)]);
  });

  it.each([
    ["2026-11-13T23:30:00+03:00", [60]],
    ["2026-11-14T00:05:00+03:00", [60, 100]],
  ])("includes trips running past midnight at %s", async (at, saturday) => {
    const route20 = await direction("20", univermag, vokzal);
    const boarding = offsetAt(route20, univermag);
    await schedule(route20, { weekday: [1450 - boarding, 1470 - boarding], weekend: [60 - boarding, 100 - boarding] });

    const response = await journeys(stopId(route20, univermag), stopId(route20, vokzal), at);

    expect(departures(response.body)).toEqual([
      minsk("2026-11-13", 1450),
      minsk("2026-11-13", 1470),
      ...saturday.map((minutes) => minsk("2026-11-14", minutes)),
    ]);
  });

  it("accepts a time in another offset", async () => {
    const route20 = await direction("20", univermag, vokzal);
    await schedule(route20, { weekday: [480 - offsetAt(route20, univermag)] });

    const response = await journeys(stopId(route20, univermag), stopId(route20, vokzal), "2026-11-09T05:00:00Z");

    expect(departures(response.body)).toEqual([minsk("2026-11-09", 480)]);
  });

  it.each([
    ["equal stops", (stop: number) => ({ from: stop, to: stop })],
    ["a missing stop", (stop: number) => ({ from: stop })],
    ["a malformed stop", (stop: number) => ({ from: "abc", to: stop })],
    ["a malformed time", (stop: number) => ({ from: stop, to: stop + 1, at: "tomorrow" })],
    ["an impossible time", (stop: number) => ({ from: stop, to: stop + 1, at: "2026-02-30T08:00:00+03:00" })],
    ["a time without an offset", (stop: number) => ({ from: stop, to: stop + 1, at: "2026-11-09T08:00:00" })],
  ])("returns 400 for %s", async (_, query) => {
    const route20 = await direction("20", univermag, vokzal);
    await schedule(route20, { weekday: [480] });

    const response = await request(app()).get("/api/journeys").query(query(stopId(route20, univermag)));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_parameters" });
  });

  it("returns 404 for an unknown stop and for a stop no scheduled direction passes", async () => {
    const route20 = await direction("20", univermag, vokzal);
    const route2 = await direction("2", "Улица Рогачёвская", "Цирк");
    await schedule(route20, { weekday: [480] });

    const unknown = await journeys(stopId(route20, univermag), 999999);
    const invisible = await journeys(stopId(route2, "Цирк"), stopId(route20, vokzal));

    expect([unknown.status, invisible.status]).toEqual([404, 404]);
    expect(invisible.body).toEqual({ error: "not_found" });
  });
});
