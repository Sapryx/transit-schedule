import { asValue } from "awilix";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { DirectionDetail, RouteSummary } from "./networkAdmin.ts";
import { overpassFixture } from "./testing/overpassFixture.ts";
import { useTestServer } from "./testing/testServer.ts";

describe("schedule", () => {
  const server = useTestServer();
  let token: string;
  let route: RouteSummary<DirectionDetail>;
  let direction: DirectionDetail;

  beforeEach(async () => {
    server.container.register({ osmSource: asValue({ fetchElements: overpassFixture }) });
    const login = await request(server.container.cradle.app).post("/api/auth/login").send({ login: "dispatcher", password: "secret" });
    token = login.body.token;
    await request(server.container.cradle.app).post("/api/admin/osm-sync").set("Authorization", `Bearer ${token}`);
    await reload();
    direction = route.directions[0];
  });

  const app = () => server.container.cradle.app;
  const put = (path: string, body: unknown) => request(app()).put(path).set("Authorization", `Bearer ${token}`).send(body as object);
  const putOffsets = (body: unknown, id = direction.id) => put(`/api/admin/directions/${id}/travel-offsets`, body);
  const putDepartures = (body: unknown, id = direction.id) => put(`/api/admin/directions/${id}/departures`, body);
  const offsets = (step: number) => direction.platforms.map((_, index) => index * step);

  async function reload() {
    const routes = (await request(app()).get("/api/admin/routes").set("Authorization", `Bearer ${token}`)).body as RouteSummary[];
    const { id } = routes.find((candidate) => candidate.number === "15")!;
    route = (await request(app()).get(`/api/admin/routes/${id}`).set("Authorization", `Bearer ${token}`)).body;
    return route.directions.find((candidate) => candidate.id === direction?.id) ?? route.directions[0];
  }

  describe("PUT /api/admin/directions/:id/travel-offsets", () => {
    it("requires a dispatcher token", async () => {
      const response = await request(app()).put(`/api/admin/directions/${direction.id}/travel-offsets`).send(offsets(2));

      expect(response.status).toBe(401);
    });

    it("stores one offset per platform in order", async () => {
      const response = await putOffsets(offsets(2));

      expect(response.status).toBe(204);
      expect((await reload()).platforms.map((platform) => platform.travelOffset)).toEqual(offsets(2));
      expect(route.directions[1].platforms.every((platform) => platform.travelOffset === null)).toBe(true);
    });

    it("accepts equal neighbouring offsets", async () => {
      const values = offsets(1).map((value) => Math.floor(value / 2));

      expect((await putOffsets(values)).status).toBe(204);
    });

    it.each([
      ["not starting at 0", (values: number[]) => values.map((value) => value + 1)],
      ["decreasing", (values: number[]) => values.with(2, 1)],
      ["fractional", (values: number[]) => values.with(1, 1.5)],
      ["negative", (values: number[]) => values.with(1, -1)],
      ["too short", (values: number[]) => values.slice(1)],
      ["too long", (values: number[]) => [...values, values.at(-1)!]],
      ["not numbers", (values: number[]) => values.map(String)],
    ])("rejects offsets %s", async (_, change) => {
      const response = await putOffsets(change(offsets(2)));

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ error: "invalid_travel_offsets" });
      expect((await reload()).platforms.every((platform) => platform.travelOffset === null)).toBe(true);
    });

    it("rejects a body that is not a list", async () => {
      const response = await putOffsets({ offsets: offsets(2) });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ error: "invalid_travel_offsets" });
    });

    it.each(["999999", "abc"])("returns 404 for an unknown direction %s", async (id) => {
      const response = await put(`/api/admin/directions/${id}/travel-offsets`, [0]);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    });
  });

  describe("PUT /api/admin/directions/:id/departures", () => {
    it("replaces weekday and weekend departures, accepting minutes past midnight", async () => {
      await putDepartures({ weekday: [360], weekend: [480] });

      const response = await putDepartures({ weekday: [1450, 400, 360], weekend: [] });

      expect(response.status).toBe(204);
      expect((await reload()).departures).toEqual({ weekday: [360, 400, 1450], weekend: [] });
      expect(route.directions[1].departures).toEqual({ weekday: [], weekend: [] });
    });

    it.each([
      ["a missing day type", { weekday: [360] }],
      ["a fractional minute", { weekday: [360.5], weekend: [] }],
      ["a negative minute", { weekday: [-1], weekend: [] }],
      ["a duplicate", { weekday: [360, 360], weekend: [] }],
      ["a minute beyond the next day", { weekday: [2880], weekend: [] }],
      ["a list instead of day types", [360]],
    ])("rejects %s", async (_, body) => {
      await putDepartures({ weekday: [300], weekend: [] });

      const response = await putDepartures(body);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ error: "invalid_departures" });
      expect((await reload()).departures).toEqual({ weekday: [300], weekend: [] });
    });

    it("returns 404 for an unknown direction", async () => {
      const response = await putDepartures({ weekday: [], weekend: [] }, 999999);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    });
  });

  describe("scheduled direction", () => {
    it("is scheduled exactly when it has a departure and every offset", async () => {
      await putOffsets(offsets(3));
      expect((await reload()).scheduled).toBe(false);

      await putDepartures({ weekday: [], weekend: [600] });
      expect((await reload()).scheduled).toBe(true);

      await putDepartures({ weekday: [], weekend: [] });
      expect((await reload()).scheduled).toBe(false);
    });
  });
});
