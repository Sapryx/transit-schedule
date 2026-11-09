import { asValue } from "awilix";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { DirectionDetail, RouteSummary } from "./networkAdmin.ts";
import { overpassFixture } from "./testing/overpassFixture.ts";
import { useTestServer } from "./testing/testServer.ts";

describe("GET /api/stops/:id/upcoming", () => {
  const server = useTestServer();
  let token: string;
  let now: Date;

  beforeEach(async () => {
    now = new Date("2026-11-09T10:00:00+03:00");
    server.container.register({ osmSource: asValue({ fetchElements: overpassFixture }), clock: asValue({ now: () => now }) });
    const login = await request(app()).post("/api/auth/login").send({ login: "dispatcher", password: "secret" });
    token = login.body.token;
    await admin("post", "/api/admin/osm-sync");
  });

  const app = () => server.container.cradle.app;
  const admin = (method: "get" | "post" | "put" | "patch", path: string, body?: object) =>
    request(app())[method](path).set("Authorization", `Bearer ${token}`).send(body);

  async function adminRoute(number: string): Promise<RouteSummary<DirectionDetail>> {
    const routes: RouteSummary[] = (await admin("get", "/api/admin/routes")).body;
    const { id } = routes.find((route) => route.number === number)!;
    return (await admin("get", `/api/admin/routes/${id}`)).body;
  }

  async function schedule(direction: DirectionDetail, departures: { weekday?: number[]; weekend?: number[] }) {
    await admin("put", `/api/admin/directions/${direction.id}/travel-offsets`, direction.platforms.map((_, position) => position * 2));
    await admin("put", `/api/admin/directions/${direction.id}/departures`, { weekday: [], weekend: [], ...departures });
  }

  const offsetAt = (direction: DirectionDetail, stopId: number) => direction.platforms.findIndex((platform) => platform.stopId === stopId) * 2;

  const upcoming = (stopId: number | string, query: Record<string, string> = {}, language?: string) => {
    const call = request(app()).get(`/api/stops/${stopId}/upcoming`).query(query);
    return language ? call.set("Accept-Language", language) : call;
  };

  async function directionNames(language: string) {
    const routes: { directions: { id: number; name: string }[] }[] = (await request(app()).get("/api/routes").set("Accept-Language", language)).body;
    return new Map(routes.flatMap((route) => route.directions.map((direction) => [direction.id, direction.name])));
  }

  const arrivals = (body: { arrival: string; minutesUntil: number }[]) => body.map(({ arrival, minutesUntil }) => [arrival, minutesUntil]);

  async function firstStopOf15(departures: { weekday?: number[]; weekend?: number[] }) {
    const [there] = (await adminRoute("15")).directions;
    await schedule(there, departures);
    return there.platforms[0].stopId;
  }

  it("lists the next arrivals across routes soonest first with minutes to go", async () => {
    const [route15, route20] = await Promise.all([adminRoute("15"), adminRoute("20")]);
    const [there] = route15.directions;
    const [line] = route20.directions;
    const stopId = there.platforms[0].stopId;
    await schedule(there, { weekday: [550, 605, 700] });
    await schedule(line, { weekday: [610 - offsetAt(line, stopId)] });

    const names = await directionNames("en");

    const response = await upcoming(stopId, {}, "en");

    expect(response.status).toBe(200);
    expect(response.headers["content-language"]).toBe("en");
    expect(response.body).toEqual([
      {
        routeId: route15.id,
        number: "15",
        mode: "trolleybus",
        directionId: there.id,
        directionName: names.get(there.id),
        arrival: "2026-11-09T10:05:00+03:00",
        minutesUntil: 5,
      },
      {
        routeId: route20.id,
        number: "20",
        mode: "bus",
        directionId: line.id,
        directionName: names.get(line.id),
        arrival: "2026-11-09T10:10:00+03:00",
        minutesUntil: 10,
      },
      expect.objectContaining({ directionId: there.id, arrival: "2026-11-09T11:40:00+03:00", minutesUntil: 100 }),
    ]);
  });

  it("names directions in Russian when asked", async () => {
    const [there] = (await adminRoute("15")).directions;
    await schedule(there, { weekday: [605] });

    const response = await upcoming(there.platforms[0].stopId, {}, "ru");

    expect(response.headers["content-language"]).toBe("ru");
    expect(response.body[0].directionName).toBe((await directionNames("ru")).get(there.id));
  });

  it("covers the next three hours", async () => {
    const stopId = await firstStopOf15({ weekday: [600, 780, 781] });

    const response = await upcoming(stopId);

    expect(arrivals(response.body)).toEqual([
      ["2026-11-09T10:00:00+03:00", 0],
      ["2026-11-09T13:00:00+03:00", 180],
    ]);
  });

  it("counts whole minutes left from a time between minutes", async () => {
    const stopId = await firstStopOf15({ weekday: [600, 605] });

    const response = await upcoming(stopId, { at: "2026-11-09T10:00:30+03:00" });

    expect(arrivals(response.body)).toEqual([["2026-11-09T10:05:00+03:00", 4]]);
  });

  it("includes trips of today running past midnight just before midnight", async () => {
    const stopId = await firstStopOf15({ weekday: [1420, 1430, 1450], weekend: [30, 300] });

    const response = await upcoming(stopId, { at: "2026-11-13T23:50:00+03:00" });

    expect(arrivals(response.body)).toEqual([
      ["2026-11-13T23:50:00+03:00", 0],
      ["2026-11-14T00:10:00+03:00", 20],
      ["2026-11-14T00:30:00+03:00", 40],
    ]);
  });

  it("includes trips of the previous day still running just after midnight", async () => {
    const stopId = await firstStopOf15({ weekday: [1430, 1450], weekend: [30, 1450] });

    const response = await upcoming(stopId, { at: "2026-11-14T00:05:00+03:00" });

    expect(arrivals(response.body)).toEqual([
      ["2026-11-14T00:10:00+03:00", 5],
      ["2026-11-14T00:30:00+03:00", 25],
    ]);
  });

  it("uses weekend departures on a holiday", async () => {
    await admin("post", "/api/admin/holidays", { date: "2026-11-10" });
    const stopId = await firstStopOf15({ weekday: [610], weekend: [620] });

    const response = await upcoming(stopId, { at: "2026-11-10T10:00:00+03:00" });

    expect(arrivals(response.body)).toEqual([["2026-11-10T10:20:00+03:00", 20]]);
  });

  it("returns at most ten arrivals unless a limit is given", async () => {
    const stopId = await firstStopOf15({ weekday: Array.from({ length: 12 }, (_, index) => 601 + index) });

    const byDefault = await upcoming(stopId);
    const limited = await upcoming(stopId, { limit: "2" });

    expect(byDefault.body).toHaveLength(10);
    expect(arrivals(limited.body)).toEqual([
      ["2026-11-09T10:01:00+03:00", 1],
      ["2026-11-09T10:02:00+03:00", 2],
    ]);
  });

  it("accepts a time in another offset", async () => {
    const stopId = await firstStopOf15({ weekday: [605] });

    const response = await upcoming(stopId, { at: "2026-11-09T07:00:00Z" });

    expect(arrivals(response.body)).toEqual([["2026-11-09T10:05:00+03:00", 5]]);
  });

  it("returns an empty list when nothing more arrives", async () => {
    const stopId = await firstStopOf15({ weekday: [360] });

    const response = await upcoming(stopId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each<Record<string, string>>([{ at: "tomorrow" }, { limit: "0" }, { limit: "abc" }])("rejects invalid parameters %o", async (query) => {
    const stopId = await firstStopOf15({ weekday: [605] });

    const response = await upcoming(stopId, query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_parameters" });
  });

  it("returns 404 for a stop no scheduled direction passes", async () => {
    const [direction] = (await adminRoute("2")).directions;

    const response = await upcoming(direction.platforms[0].stopId);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
  });

  it.each(["999999", "abc"])("returns 404 for an unknown stop %s", async (id) => {
    expect((await upcoming(id)).status).toBe(404);
  });
});
