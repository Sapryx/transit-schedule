import { asValue } from "awilix";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertPlatform, overpassFixture } from "./testing/overpassFixture.ts";
import { useTestServer } from "./testing/testServer.ts";
import type { RouteSummary as Route } from "./networkAdmin.ts";
import type { OsmElement } from "./osm/osmSource.ts";

describe("network admin", () => {
  const server = useTestServer();
  let fetchElements: ReturnType<typeof vi.fn>;
  let token: string;

  beforeEach(async () => {
    fetchElements = vi.fn(overpassFixture);
    server.container.register({ osmSource: asValue({ fetchElements }) });
    const login = await request(server.container.cradle.app).post("/api/auth/login").send({ login: "dispatcher", password: "secret" });
    token = login.body.token;
    await sync();
  });

  const get = (path: string) => request(server.container.cradle.app).get(path).set("Authorization", `Bearer ${token}`);
  const sql = (text: string, values: unknown[] = []) => server.container.cradle.pool.query(text, values);
  const sync = () => request(server.container.cradle.app).post("/api/admin/osm-sync").set("Authorization", `Bearer ${token}`);

  async function routeNumbered(number: string): Promise<Route> {
    const response = await get("/api/admin/routes");
    return response.body.find((route: Route) => route.number === number);
  }

  function serveOsm(change: (elements: OsmElement[]) => OsmElement[]) {
    fetchElements.mockImplementation(async () => change(await overpassFixture()));
  }

  describe("GET /api/admin/routes", () => {
    it("requires a dispatcher token", async () => {
      const response = await request(server.container.cradle.app).get("/api/admin/routes");

      expect(response.status).toBe(401);
    });

    it("lists synced routes with their mode, state and directions named by their end and via stops", async () => {
      const response = await get("/api/admin/routes");

      expect(response.status).toBe(200);
      expect(response.body.map((route: Route) => [route.number, route.mode, route.directions.length])).toEqual(
        expect.arrayContaining([
          ["2", "trolleybus", 1],
          ["15", "trolleybus", 2],
          ["43", "bus", 4],
          ["20", "bus", 1],
        ]),
      );
      expect(await routeNumbered("15")).toEqual({
        id: expect.any(Number),
        number: "15",
        mode: "trolleybus",
        withdrawn: false,
        missingFromOsm: false,
        directions: [
          {
            id: expect.any(Number),
            name: {
              from: { ru: "Волотова", en: "Volotova" },
              to: { ru: "Вокзал", en: "Vokzal" },
              via: { ru: "Храм Преображения Господня", en: "Khram Preobrazheniya Gospodnya" },
            },
            scheduled: false,
            needsReview: false,
            missingFromOsm: false,
          },
          {
            id: expect.any(Number),
            name: {
              from: { ru: "Волотова", en: "Volotova" },
              to: { ru: "Вокзал", en: "Vokzal" },
              via: { ru: "улица Петруся Бровки", en: "ulitsa Petrusya Brovki" },
            },
            scheduled: false,
            needsReview: false,
            missingFromOsm: false,
          },
        ],
      });
    });

    it("reports a direction scheduled once it has a departure and every travel offset", async () => {
      const [direction] = (await routeNumbered("15")).directions;
      await sql("INSERT INTO departures (direction_id, day_type, minutes) VALUES ($1, 'weekday', 360)", [direction.id]);
      await sql("UPDATE direction_platforms SET travel_offset = position * 2 WHERE direction_id = $1 AND position > 0", [direction.id]);
      expect((await routeNumbered("15")).directions[0].scheduled).toBe(false);

      await sql("UPDATE direction_platforms SET travel_offset = 0 WHERE direction_id = $1 AND position = 0", [direction.id]);

      expect((await routeNumbered("15")).directions[0].scheduled).toBe(true);
    });

    it("reports a direction without departures unscheduled", async () => {
      const [direction] = (await routeNumbered("15")).directions;
      await sql("UPDATE direction_platforms SET travel_offset = position WHERE direction_id = $1", [direction.id]);

      expect((await routeNumbered("15")).directions[0].scheduled).toBe(false);
    });

    it("reports withdrawn routes", async () => {
      const route = await routeNumbered("2");
      await sql("UPDATE routes SET withdrawn = true WHERE id = $1", [route.id]);

      expect((await routeNumbered("2")).withdrawn).toBe(true);
    });

    it("reports routes and directions missing from OSM", async () => {
      serveOsm((elements) => elements.filter((element) => element.id !== 15708026 && element.id !== 15708027));
      await sync();

      const route = await routeNumbered("20");

      expect(route.missingFromOsm).toBe(true);
      expect(route.directions[0].missingFromOsm).toBe(true);
    });

    it("reports a resequenced scheduled direction as needing review", async () => {
      const direction = (await routeNumbered("15")).directions[0];
      await sql("UPDATE direction_platforms SET travel_offset = position * 3 WHERE direction_id = $1", [direction.id]);
      serveOsm(insertPlatform);
      await sync();

      expect((await routeNumbered("15")).directions[0].needsReview).toBe(true);
    });
  });

  describe("GET /api/admin/routes/:id", () => {
    it("returns the route with ordered platforms, departures and path of each direction", async () => {
      const { id, directions } = await routeNumbered("15");
      await sql("INSERT INTO departures (direction_id, day_type, minutes) VALUES ($1, 'weekend', 1450), ($1, 'weekday', 400), ($1, 'weekday', 360)", [directions[0].id]);

      const response = await get(`/api/admin/routes/${id}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id, number: "15", mode: "trolleybus", withdrawn: false, missingFromOsm: false });
      const [first, second] = response.body.directions;
      expect(first).toMatchObject({ ...directions[0], departures: { weekday: [360, 400], weekend: [1450] } });
      expect(second).toMatchObject({ ...directions[1], departures: { weekday: [], weekend: [] } });
      expect(first.platforms[0]).toEqual({
        platformId: expect.any(Number),
        stopId: expect.any(Number),
        stopName: { ru: "Волотова", en: "Volotova" },
        lat: expect.any(Number),
        lon: expect.any(Number),
        travelOffset: null,
        interpolated: false,
      });
      expect(first.platforms.at(-1).stopName).toEqual(first.name.to);
      expect(first.path.length).toBeGreaterThan(1);
      expect(first.path[0]).toEqual([expect.any(Number), expect.any(Number)]);
    });

    it("marks platforms whose offsets sync interpolated", async () => {
      const { id, directions } = await routeNumbered("15");
      await sql("UPDATE direction_platforms SET travel_offset = position * 3 WHERE direction_id = $1", [directions[0].id]);
      serveOsm(insertPlatform);
      await sync();

      const response = await get(`/api/admin/routes/${id}`);

      const platforms = response.body.directions[0].platforms;
      expect(platforms.slice(0, 4).map((platform: { travelOffset: number; interpolated: boolean }) => [platform.travelOffset, platform.interpolated])).toEqual([
        [0, false],
        [3, false],
        [5, true],
        [6, false],
      ]);
      expect(platforms[2].stopName.ru).toBe("Новая");
    });

    it.each(["999", "abc"])("returns 404 for an unknown route %s", async (id) => {
      const response = await get(`/api/admin/routes/${id}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    });
  });
});
