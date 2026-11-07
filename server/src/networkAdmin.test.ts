import { asValue } from "awilix";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertPlatform, overpassFixture } from "./testing/overpassFixture.ts";
import { useTestServer } from "./testing/testServer.ts";
import type { RouteSummary as Route, StopSummary } from "./networkAdmin.ts";
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
  const send = (method: "post" | "patch" | "delete", path: string) => request(server.container.cradle.app)[method](path).set("Authorization", `Bearer ${token}`);
  const sql = (text: string, values: unknown[] = []) => server.container.cradle.pool.query(text, values);
  const sync = () => request(server.container.cradle.app).post("/api/admin/osm-sync").set("Authorization", `Bearer ${token}`);

  async function routeNumbered(number: string): Promise<Route> {
    const response = await get("/api/admin/routes");
    return response.body.find((route: Route) => route.number === number);
  }

  async function stopNamed(ru: string): Promise<StopSummary> {
    const response = await get("/api/admin/stops");
    return response.body.find((stop: { name: { ru: string } }) => stop.name.ru === ru);
  }

  async function dropRoute20() {
    serveOsm((elements) => elements.filter((element) => element.id !== 15708026 && element.id !== 15708027));
    await sync();
    return routeNumbered("20");
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

  describe("POST /api/admin/directions/:id/review", () => {
    it("clears needs review and the interpolated marks keeping the offsets", async () => {
      const { id, directions } = await routeNumbered("15");
      await sql("UPDATE direction_platforms SET travel_offset = position * 3 WHERE direction_id = $1", [directions[0].id]);
      serveOsm(insertPlatform);
      await sync();

      const response = await send("post", `/api/admin/directions/${directions[0].id}/review`);

      expect(response.status).toBe(204);
      const [direction] = (await get(`/api/admin/routes/${id}`)).body.directions;
      expect(direction.needsReview).toBe(false);
      expect(direction.platforms.slice(0, 4).map((platform: { travelOffset: number }) => platform.travelOffset)).toEqual([0, 3, 5, 6]);
      expect(direction.platforms.some((platform: { interpolated: boolean }) => platform.interpolated)).toBe(false);
    });

    it.each(["999", "abc"])("returns 404 for an unknown direction %s", async (id) => {
      const response = await send("post", `/api/admin/directions/${id}/review`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    });
  });

  describe("PATCH /api/admin/routes/:id", () => {
    it("withdraws a route and returns it to service keeping its schedule", async () => {
      const { id, directions } = await routeNumbered("15");
      await sql("INSERT INTO departures (direction_id, day_type, minutes) VALUES ($1, 'weekday', 360)", [directions[0].id]);

      expect((await send("patch", `/api/admin/routes/${id}`).send({ withdrawn: true })).status).toBe(204);
      expect((await routeNumbered("15")).withdrawn).toBe(true);

      expect((await send("patch", `/api/admin/routes/${id}`).send({ withdrawn: false })).status).toBe(204);
      const route = (await get(`/api/admin/routes/${id}`)).body;
      expect(route.withdrawn).toBe(false);
      expect(route.directions[0].departures.weekday).toEqual([360]);
    });

    it.each([{}, { withdrawn: "yes" }, { withdrawn: null }])("rejects %j", async (body) => {
      const { id } = await routeNumbered("15");

      const response = await send("patch", `/api/admin/routes/${id}`).send(body);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ error: "invalid_withdrawn" });
    });

    it.each(["999", "abc"])("returns 404 for an unknown route %s", async (id) => {
      const response = await send("patch", `/api/admin/routes/${id}`).send({ withdrawn: true });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    });
  });

  describe("DELETE /api/admin/routes/:id", () => {
    it("deletes a route missing from OSM with its directions and schedule", async () => {
      const route = await dropRoute20();
      await sql("INSERT INTO departures (direction_id, day_type, minutes) VALUES ($1, 'weekday', 360)", [route.directions[0].id]);

      const response = await send("delete", `/api/admin/routes/${route.id}`);

      expect(response.status).toBe(204);
      expect(await routeNumbered("20")).toBeUndefined();
      expect((await get(`/api/admin/routes/${route.id}`)).status).toBe(404);
    });

    it("refuses to delete a route present in OSM", async () => {
      const { id } = await routeNumbered("15");

      const response = await send("delete", `/api/admin/routes/${id}`);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "not_missing_from_osm" });
      expect(await routeNumbered("15")).toBeDefined();
    });

    it.each(["999", "abc"])("returns 404 for an unknown route %s", async (id) => {
      expect((await send("delete", `/api/admin/routes/${id}`)).status).toBe(404);
    });
  });

  describe("DELETE /api/admin/directions/:id", () => {
    it("deletes a direction missing from OSM with its schedule", async () => {
      const route = await dropRoute20();
      await sql("INSERT INTO departures (direction_id, day_type, minutes) VALUES ($1, 'weekday', 360)", [route.directions[0].id]);

      const response = await send("delete", `/api/admin/directions/${route.directions[0].id}`);

      expect(response.status).toBe(204);
      expect((await routeNumbered("20")).directions).toEqual([]);
    });

    it("refuses to delete a direction present in OSM", async () => {
      const { directions } = await routeNumbered("15");

      const response = await send("delete", `/api/admin/directions/${directions[0].id}`);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "not_missing_from_osm" });
    });

    it.each(["999", "abc"])("returns 404 for an unknown direction %s", async (id) => {
      expect((await send("delete", `/api/admin/directions/${id}`)).status).toBe(404);
    });
  });

  describe("stops", () => {
    it("lists stops with names and the missing-from-OSM flag", async () => {
      const response = await get("/api/admin/stops");

      expect(response.status).toBe(200);
      expect(await stopNamed("Волотова")).toEqual({ id: expect.any(Number), name: { ru: "Волотова", en: "Volotova" }, missingFromOsm: false });
    });

    it("deletes a stop missing from OSM with its platforms", async () => {
      serveOsm(insertPlatform);
      await sync();
      serveOsm((elements) => elements);
      await sync();
      const stop = await stopNamed("Новая");
      expect(stop.missingFromOsm).toBe(true);

      const response = await send("delete", `/api/admin/stops/${stop.id}`);

      expect(response.status).toBe(204);
      expect(await stopNamed("Новая")).toBeUndefined();
      expect((await sql("SELECT count(*)::int AS count FROM platforms WHERE stop_id = $1", [stop.id])).rows[0].count).toBe(0);
    });

    it("refuses to delete a stop a direction still passes through", async () => {
      const stop = await stopNamed("Волотова");
      await sql("UPDATE stops SET missing_from_osm = true WHERE id = $1", [stop.id]);

      const response = await send("delete", `/api/admin/stops/${stop.id}`);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "stop_in_use" });
      expect(await stopNamed("Волотова")).toBeDefined();
    });

    it("refuses to delete a stop present in OSM", async () => {
      const stop = await stopNamed("Волотова");

      const response = await send("delete", `/api/admin/stops/${stop.id}`);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "not_missing_from_osm" });
    });

    it.each(["999999", "abc"])("returns 404 for an unknown stop %s", async (id) => {
      expect((await send("delete", `/api/admin/stops/${id}`)).status).toBe(404);
    });
  });
});
