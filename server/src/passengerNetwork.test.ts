import { asValue } from "awilix";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DirectionDetail, RouteSummary } from "./networkAdmin.ts";
import { edit, overpassFixture } from "./testing/overpassFixture.ts";
import { useTestServer } from "./testing/testServer.ts";

describe("passenger network", () => {
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

  async function schedule(number: string, index = 0) {
    const direction = (await adminRoute(number)).directions[index];
    await admin("put", `/api/admin/directions/${direction.id}/travel-offsets`, direction.platforms.map((_, position) => position * 2));
    await admin("put", `/api/admin/directions/${direction.id}/departures`, { weekday: [360], weekend: [] });
    return direction;
  }

  describe("GET /api/routes", () => {
    it("is public and lists nothing until a direction is scheduled", async () => {
      const response = await passenger("/api/routes");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("lists routes in service sorted naturally by number with only their scheduled directions", async () => {
      await Promise.all([schedule("43", 1), schedule("15"), schedule("2"), schedule("20")]);
      const route15 = await adminRoute("15");

      const response = await passenger("/api/routes", "en");

      expect(response.body.map((route: { number: string }) => route.number)).toEqual(["2", "15", "20", "43"]);
      expect(response.body[1]).toEqual({
        id: route15.id,
        number: "15",
        mode: "trolleybus",
        directions: [{ id: route15.directions[0].id, name: "Volotova → Vokzal via Khram Preobrazheniya Gospodnya" }],
      });
      expect(response.body[3].directions).toHaveLength(1);
    });

    it("sorts a number with a letter suffix after its base number", async () => {
      fetchElements.mockImplementation(async () => edit(await overpassFixture(), 15708026, (element) => ({ ...element, tags: { ...element.tags, ref: "2A" } })));
      await admin("post", "/api/admin/osm-sync");
      await Promise.all([schedule("15"), schedule("2A"), schedule("2")]);

      const response = await passenger("/api/routes");

      expect(response.body.map((route: { number: string }) => route.number)).toEqual(["2", "2A", "15"]);
    });

    it("names directions in Russian when asked", async () => {
      await schedule("15");

      const response = await passenger("/api/routes", "ru-RU,ru;q=0.9");

      expect(response.headers["content-language"]).toBe("ru");
      expect(response.body[0].directions[0].name).toBe("Волотова → Вокзал через Храм Преображения Господня");
    });

    it.each([["de"], [undefined]])("falls back to English for Accept-Language %s", async (language) => {
      await schedule("15");

      const response = await passenger("/api/routes", language);

      expect(response.headers["content-language"]).toBe("en");
      expect(response.body[0].directions[0].name).toBe("Volotova → Vokzal via Khram Preobrazheniya Gospodnya");
    });

    it("names a direction without a via stop by its ends", async () => {
      const direction = await schedule("2");
      const { from, to, via } = direction.name;

      const response = await passenger("/api/routes", "ru");

      expect(via).toBeNull();
      expect(response.body[0].directions[0].name).toBe(`${from.ru} → ${to.ru}`);
    });

    it("hides withdrawn routes and directions that lose their departures", async () => {
      await schedule("2");
      const direction = await schedule("15");
      await admin("patch", `/api/admin/routes/${(await adminRoute("2")).id}`, { withdrawn: true });
      await admin("put", `/api/admin/directions/${direction.id}/departures`, { weekday: [], weekend: [] });

      expect((await passenger("/api/routes")).body).toEqual([]);
    });
  });

  describe("GET /api/routes/:id", () => {
    it("returns the scheduled directions with their stops in travel order and path", async () => {
      await schedule("15", 1);
      const route = await adminRoute("15");
      const direction = route.directions[1];

      const response = await passenger(`/api/routes/${route.id}`, "ru");

      expect(response.status).toBe(200);
      expect(response.headers["content-language"]).toBe("ru");
      expect(response.body).toEqual({
        id: route.id,
        number: "15",
        mode: "trolleybus",
        directions: [
          {
            id: direction.id,
            name: "Волотова → Вокзал через улица Петруся Бровки",
            stops: direction.platforms.map((platform, position) => ({
              stopId: platform.stopId,
              platformId: platform.platformId,
              name: platform.stopName.ru,
              lat: platform.lat,
              lon: platform.lon,
              travelOffset: position * 2,
            })),
            path: direction.path,
          },
        ],
      });
    });

    it("names stops in English by default", async () => {
      const direction = await schedule("15");

      const response = await passenger(`/api/routes/${(await adminRoute("15")).id}`);

      expect(response.body.directions[0].stops.map((stop: { name: string }) => stop.name)).toEqual(direction.platforms.map((platform) => platform.stopName.en));
    });

    it("returns 404 for a route without a scheduled direction", async () => {
      const response = await passenger(`/api/routes/${(await adminRoute("15")).id}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    });

    it("returns 404 for a withdrawn route", async () => {
      await schedule("15");
      const { id } = await adminRoute("15");
      await admin("patch", `/api/admin/routes/${id}`, { withdrawn: true });

      expect((await passenger(`/api/routes/${id}`)).status).toBe(404);
    });

    it.each(["999999", "abc"])("returns 404 for an unknown route %s", async (id) => {
      const response = await passenger(`/api/routes/${id}`, "ru");

      expect(response.status).toBe(404);
      expect(response.headers["content-language"]).toBe("ru");
      expect(response.body).toEqual({ error: "not_found" });
    });
  });
});
