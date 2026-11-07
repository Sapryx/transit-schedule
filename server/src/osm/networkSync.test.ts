import { asValue } from "awilix";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { overpassFixture } from "../testing/overpassFixture.ts";
import { useTestServer } from "../testing/testServer.ts";

const firstSyncReport = {
  stops: { created: 124 },
  platforms: { created: 125 },
  routes: { created: 4 },
  directions: { created: 8 },
  skippedRoutes: [
    { ref: "671", reason: "regional" },
    { ref: null, reason: "no_ref" },
  ],
};

describe("OSM sync", () => {
  const server = useTestServer();
  let fetchElements: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchElements = vi.fn(overpassFixture);
    server.container.register({ osmSource: asValue({ fetchElements }) });
  });

  async function sync() {
    const { app } = server.container.cradle;
    const login = await request(app).post("/api/auth/login").send({ login: "dispatcher", password: "secret" });
    return request(app).post("/api/admin/osm-sync").set("Authorization", `Bearer ${login.body.token}`);
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

    it("does not create the same objects twice", async () => {
      await sync();

      const response = await sync();

      expect(response.body).toEqual({
        ...firstSyncReport,
        stops: { created: 0 },
        platforms: { created: 0 },
        routes: { created: 0 },
        directions: { created: 0 },
      });
    });
  });

  describe("on startup", () => {
    it("fills an empty network", async () => {
      await server.container.cradle.networkSync.syncIfEmpty();

      expect(fetchElements).toHaveBeenCalledTimes(1);
      expect((await sync()).body.routes).toEqual({ created: 0 });
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
