import { asValue } from "awilix";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DirectionDetail, RouteSummary } from "./networkAdmin.ts";
import type { OsmElement } from "./osm/osmSource.ts";
import { edit, overpassFixture } from "./testing/overpassFixture.ts";
import { useTestServer } from "./testing/testServer.ts";

const circularRouteOsmId = 7900930;

describe("GET /api/stops/:id/schedule", () => {
  const server = useTestServer();
  let token: string;
  let fetchElements: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchElements = vi.fn(overpassFixture);
    server.container.register({ osmSource: asValue({ fetchElements }) });
    const login = await request(app()).post("/api/auth/login").send({ login: "dispatcher", password: "secret" });
    token = login.body.token;
    await admin("post", "/api/admin/osm-sync");
  });

  const app = () => server.container.cradle.app;
  const admin = (method: "get" | "post" | "put" | "patch", path: string, body?: object) =>
    request(app())[method](path).set("Authorization", `Bearer ${token}`).send(body);
  const passenger = (path: string, language?: string) => {
    const call = request(app()).get(path);
    return language ? call.set("Accept-Language", language) : call;
  };

  async function adminRoute(number: string): Promise<RouteSummary<DirectionDetail>> {
    const routes: RouteSummary[] = (await admin("get", "/api/admin/routes")).body;
    const { id } = routes.find((route) => route.number === number)!;
    return (await admin("get", `/api/admin/routes/${id}`)).body;
  }

  async function schedule(direction: DirectionDetail, departures: { weekday: number[]; weekend: number[] }) {
    await admin("put", `/api/admin/directions/${direction.id}/travel-offsets`, direction.platforms.map((_, position) => position * 2));
    await admin("put", `/api/admin/directions/${direction.id}/departures`, departures);
  }

  const offsetsAt = (direction: DirectionDetail, stopId: number) =>
    direction.platforms.flatMap((platform, position) => (platform.stopId === stopId ? [position * 2] : []));

  async function directionNames(language: string) {
    const routes: { directions: { id: number; name: string }[] }[] = (await passenger("/api/routes", language)).body;
    return new Map(routes.flatMap((route) => route.directions.map((direction) => [direction.id, direction.name])));
  }

  it("lists arrivals per route and direction for the day type, merging the platforms of the stop", async () => {
    const [route15, route20] = await Promise.all([adminRoute("15"), adminRoute("20")]);
    const [there, back] = route15.directions;
    const [line] = route20.directions;
    await schedule(there, { weekday: [360, 1430], weekend: [480] });
    await schedule(back, { weekday: [400], weekend: [] });
    await schedule(line, { weekday: [300], weekend: [310] });
    const stopId = there.platforms[0].stopId;
    const [lineOffset] = offsetsAt(line, stopId);
    const names = await directionNames("en");

    const weekday = await passenger(`/api/stops/${stopId}/schedule?dayType=weekday`, "en");
    const weekend = await passenger(`/api/stops/${stopId}/schedule?dayType=weekend`, "en");

    expect(line.platforms.find((platform) => platform.stopId === stopId)!.platformId).not.toBe(there.platforms[0].platformId);
    expect(weekday.status).toBe(200);
    expect(weekday.headers["content-language"]).toBe("en");
    expect(weekday.body).toEqual([
      { routeId: route20.id, number: "20", mode: "bus", directionId: line.id, directionName: names.get(line.id), arrivals: [300 + lineOffset] },
      { routeId: route15.id, number: "15", mode: "trolleybus", directionId: there.id, directionName: names.get(there.id), arrivals: [360, 1430] },
      { routeId: route15.id, number: "15", mode: "trolleybus", directionId: back.id, directionName: names.get(back.id), arrivals: [400] },
    ]);
    expect(weekend.body.map((entry: { arrivals: number[] }) => entry.arrivals)).toEqual([[310 + lineOffset], [480], []]);
  });

  it("names directions in Russian when asked", async () => {
    const [direction] = (await adminRoute("15")).directions;
    await schedule(direction, { weekday: [360], weekend: [] });

    const response = await passenger(`/api/stops/${direction.platforms[0].stopId}/schedule?dayType=weekday`, "ru");

    expect(response.headers["content-language"]).toBe("ru");
    expect(response.body[0].directionName).toBe((await directionNames("ru")).get(direction.id));
  });

  it("lists both passes of a circular direction in time order", async () => {
    fetchElements.mockImplementation(async () =>
      edit(await overpassFixture(), circularRouteOsmId, (element) => {
        const relation = element as Extract<OsmElement, { type: "relation" }>;
        return { ...relation, members: [...relation.members, relation.members.find((member) => member.role === "platform")!] };
      }),
    );
    await admin("post", "/api/admin/osm-sync");
    const [circle] = (await adminRoute("2")).directions;
    await schedule(circle, { weekday: [360, 420], weekend: [] });
    const stopId = circle.platforms.at(-1)!.stopId;
    const [first, second] = offsetsAt(circle, stopId);

    const response = await passenger(`/api/stops/${stopId}/schedule?dayType=weekday`);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].arrivals).toEqual([360 + first, 420 + first, 360 + second, 420 + second].sort((a, b) => a - b));
  });

  it("returns 404 for a stop no scheduled direction passes", async () => {
    const [direction] = (await adminRoute("2")).directions;

    const response = await passenger(`/api/stops/${direction.platforms[0].stopId}/schedule?dayType=weekday`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
  });

  it("returns 404 for a stop of a withdrawn route", async () => {
    const route = await adminRoute("2");
    await schedule(route.directions[0], { weekday: [360], weekend: [] });
    await admin("patch", `/api/admin/routes/${route.id}`, { withdrawn: true });

    expect((await passenger(`/api/stops/${route.directions[0].platforms[0].stopId}/schedule?dayType=weekday`)).status).toBe(404);
  });

  it.each(["999999", "abc"])("returns 404 for an unknown stop %s", async (id) => {
    expect((await passenger(`/api/stops/${id}/schedule?dayType=weekday`)).status).toBe(404);
  });

  it.each(["", "?dayType=holiday"])("rejects a missing or unknown day type %s", async (query) => {
    const [direction] = (await adminRoute("2")).directions;
    await schedule(direction, { weekday: [360], weekend: [] });

    const response = await passenger(`/api/stops/${direction.platforms[0].stopId}/schedule${query}`);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: "invalid_day_type" });
  });
});
