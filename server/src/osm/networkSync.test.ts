import { asValue } from "awilix";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { overpassFixture } from "../testing/overpassFixture.ts";
import { useTestServer } from "../testing/testServer.ts";
import type { OsmElement } from "./osmSource.ts";

const unchanged = { created: 0, updated: 0, missing: 0 };
const skippedRoutes = [
  { ref: "671", reason: "regional" },
  { ref: null, reason: "no_ref" },
];
const firstSyncReport = {
  stops: { ...unchanged, created: 124 },
  platforms: { ...unchanged, created: 125 },
  routes: { ...unchanged, created: 4 },
  directions: { ...unchanged, created: 8 },
  needsReview: [],
  skippedRoutes,
};
const unchangedReport = { stops: unchanged, platforms: unchanged, routes: unchanged, directions: unchanged, needsReview: [], skippedRoutes };

const lonePlatform: OsmElement = { type: "node", id: 1, lat: 52.466, lon: 31.03, tags: { public_transport: "platform", "name:ru": "Новая" } };

function edit(elements: OsmElement[], id: number, change: (element: OsmElement) => OsmElement): OsmElement[] {
  return elements.map((element) => (element.id === id ? change(element) : element));
}

function insertPlatform(elements: OsmElement[]): OsmElement[] {
  const inserted = edit(elements, 7911648, (element) => {
    const relation = element as Extract<OsmElement, { type: "relation" }>;
    const members = [...relation.members];
    members.splice(members.findIndex((member) => member.ref === 5336093616) + 1, 0, { type: "node", ref: lonePlatform.id, role: "platform" });
    return { ...relation, members };
  });
  return [...inserted, lonePlatform];
}

describe("OSM sync", () => {
  const server = useTestServer();
  let fetchElements: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchElements = vi.fn(overpassFixture);
    server.container.register({ osmSource: asValue({ fetchElements }) });
  });

  function serveOsm(change: (elements: OsmElement[]) => OsmElement[]) {
    fetchElements.mockImplementation(async () => change(await overpassFixture()));
  }

  async function sync() {
    const { app } = server.container.cradle;
    const login = await request(app).post("/api/auth/login").send({ login: "dispatcher", password: "secret" });
    return request(app).post("/api/admin/osm-sync").set("Authorization", `Bearer ${login.body.token}`);
  }

  async function directionId(osmId: string): Promise<number> {
    const { rows } = await server.container.cradle.pool.query<{ id: number }>("SELECT id FROM directions WHERE osm_id = $1", [osmId]);
    return rows[0].id;
  }

  describe("POST /api/admin/osm-sync", () => {
    it("requires a dispatcher token", async () => {
      const response = await request(server.container.cradle.app).post("/api/admin/osm-sync");

      expect(response.status).toBe(401);
      expect(fetchElements).not.toHaveBeenCalled();
    });

    it("creates the network from OSM and reports what it created", async () => {
      const response = await sync();

      expect(response.status).toBe(200);
      expect(response.body).toEqual(firstSyncReport);
    });

    it("reports no changes when OSM has not changed", async () => {
      await sync();

      const response = await sync();

      expect(response.body).toEqual(unchangedReport);
    });

    it("updates a renamed stop", async () => {
      await sync();
      serveOsm((elements) => edit(elements, 15704016, (stopArea) => ({ ...stopArea, tags: { ...stopArea.tags, "name:ru": "Храм" } })));

      const response = await sync();

      expect(response.body).toEqual({ ...unchangedReport, stops: { ...unchanged, updated: 1 } });
    });

    it("updates a moved platform", async () => {
      await sync();
      serveOsm((elements) => edit(elements, 5336093616, (platform) => ({ ...platform, lat: 52.466 })));

      const response = await sync();

      expect(response.body).toEqual({ ...unchangedReport, platforms: { ...unchanged, updated: 1 } });
    });

    it("marks a route that vanished from OSM missing and keeps its departures", async () => {
      await sync();
      const direction = await directionId("relation/15708026");
      await server.container.cradle.pool.query("INSERT INTO departures (direction_id, day_type, minutes) VALUES ($1, 'weekday', 360)", [direction]);
      serveOsm((elements) => elements.filter((element) => element.id !== 15708026 && element.id !== 15708027));

      const response = await sync();

      expect(response.body.routes).toEqual({ ...unchanged, missing: 1 });
      expect(response.body.directions).toEqual({ ...unchanged, missing: 1 });
      const { rows } = await server.container.cradle.pool.query("SELECT minutes FROM departures WHERE direction_id = $1", [direction]);
      expect(rows).toEqual([{ minutes: 360 }]);
    });

    it("unmarks a route that reappears in OSM", async () => {
      await sync();
      serveOsm((elements) => elements.filter((element) => element.id !== 15708026 && element.id !== 15708027));
      await sync();
      fetchElements.mockImplementation(overpassFixture);

      const response = await sync();

      expect(response.body.routes).toEqual({ ...unchanged, updated: 1 });
      expect(response.body.directions).toEqual({ ...unchanged, updated: 1 });
      expect(response.body.stops.missing).toBe(0);
      expect(response.body.platforms.missing).toBe(0);
    });

    it("updates the platform sequence of an unscheduled direction without flagging it", async () => {
      await sync();
      serveOsm(insertPlatform);

      const response = await sync();

      expect(response.body).toEqual({
        ...unchangedReport,
        stops: { ...unchanged, created: 1 },
        platforms: { ...unchanged, created: 1 },
        directions: { ...unchanged, updated: 1 },
      });
    });

    it("interpolates the offset of an inserted platform and flags a scheduled direction for review", async () => {
      await sync();
      const direction = await directionId("relation/7911648");
      await server.container.cradle.pool.query("UPDATE direction_platforms SET travel_offset = position * 3 WHERE direction_id = $1", [direction]);
      serveOsm(insertPlatform);

      const response = await sync();

      expect(response.body.needsReview).toEqual([direction]);
      const { rows } = await server.container.cradle.pool.query<{ travel_offset: number }>(
        "SELECT travel_offset FROM direction_platforms WHERE direction_id = $1 ORDER BY position LIMIT 4",
        [direction],
      );
      expect(rows.map((row) => row.travel_offset)).toEqual([0, 3, 5, 6]);
    });

    it("rejects a sync while another one runs", async () => {
      let release = () => {};
      fetchElements.mockImplementation(async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return overpassFixture();
      });
      const first = sync();
      await vi.waitFor(() => expect(fetchElements).toHaveBeenCalled());

      const second = await sync();
      release();

      expect(second.status).toBe(409);
      expect(second.body).toEqual({ error: "sync_in_progress" });
      expect((await first).status).toBe(200);
    });

    it("reports an Overpass failure and changes nothing", async () => {
      fetchElements.mockRejectedValueOnce(new Error("Overpass responded with 504"));

      const response = await sync();

      expect(response.status).toBe(502);
      expect(response.body).toEqual({ error: "overpass_unavailable" });
      expect((await sync()).body).toEqual(firstSyncReport);
    });
  });

  describe("on startup", () => {
    it("fills an empty network", async () => {
      await server.container.cradle.networkSync.syncIfEmpty();

      expect(fetchElements).toHaveBeenCalledTimes(1);
      expect((await sync()).body.routes).toEqual(unchanged);
    });

    it("leaves a filled network alone", async () => {
      await sync();
      fetchElements.mockClear();

      await server.container.cradle.networkSync.syncIfEmpty();

      expect(fetchElements).not.toHaveBeenCalled();
    });

    it("logs an Overpass failure and keeps the server running", async () => {
      fetchElements.mockRejectedValue(new Error("Overpass responded with 504"));
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      await server.container.cradle.networkSync.syncIfEmpty();

      expect(log).toHaveBeenCalledWith("OSM sync failed: Overpass responded with 504");
      log.mockRestore();
      expect((await request(server.container.cradle.app).get("/health")).status).toBe(200);
    });
  });
});
