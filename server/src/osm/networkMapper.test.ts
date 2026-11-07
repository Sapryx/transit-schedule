import { beforeAll, describe, expect, it } from "vitest";
import { overpassFixture } from "../testing/overpassFixture.ts";
import { mapNetwork, type CandidateNetwork } from "./networkMapper.ts";
import type { OsmElement } from "./osmSource.ts";

describe("mapNetwork on recorded Overpass data", () => {
  let network: CandidateNetwork;

  beforeAll(async () => {
    network = mapNetwork(await overpassFixture());
  });

  const route = (osmId: string) => network.routes.find((candidate) => candidate.osmId === osmId)!;
  const direction = (osmId: string) => network.routes.flatMap((candidate) => candidate.directions).find((candidate) => candidate.osmId === osmId)!;

  it("keeps numbered city routes grouped by route_master", () => {
    expect(network.routes.map(({ osmId, number, transportMode, directions }) => ({ osmId, number, transportMode, directions: directions.map((d) => d.osmId) }))).toEqual([
      { osmId: "trolleybus/2", number: "2", transportMode: "trolleybus", directions: ["relation/7900930"] },
      { osmId: "relation/7915342", number: "15", transportMode: "trolleybus", directions: ["relation/7911648", "relation/7911683"] },
      { osmId: "relation/8043990", number: "43", transportMode: "bus", directions: ["relation/8041234", "relation/8043974", "relation/8043975", "relation/8043989"] },
      { osmId: "relation/15708027", number: "20", transportMode: "bus", directions: ["relation/15708026"] },
    ]);
  });

  it("skips regional and unnumbered routes", () => {
    expect(network.skippedRoutes).toEqual([
      { ref: "671", reason: "regional" },
      { ref: null, reason: "no_ref" },
    ]);
  });

  it("orders platforms as the route relation lists them", () => {
    expect(direction("relation/8043974").platformOsmIds.slice(0, 3)).toEqual(["node/5380394688", "node/3324547474", "node/5336384457"]);
    expect(direction("relation/7900930").platformOsmIds).toHaveLength(28);
  });

  it("gives a circular route a single direction", () => {
    expect(route("trolleybus/2").directions).toHaveLength(1);
  });

  it("adds via to a variant sharing both ends with another one", () => {
    expect(direction("relation/8043974").viaStopOsmId).toBe("relation/10947468");
    expect(direction("relation/8041234").viaStopOsmId).toBeNull();
    expect(direction("relation/8043989").viaStopOsmId).toBeNull();
    expect(direction("relation/8043975").viaStopOsmId).toBeNull();
  });

  it("groups platforms of a stop_area into one stop", () => {
    const platforms = network.platforms.filter((platform) => platform.stopOsmId === "relation/15708025");

    expect(platforms).toHaveLength(2);
    expect(network.stops.find((stop) => stop.osmId === "relation/15708025")).toEqual({ osmId: "relation/15708025", nameRu: "Волотова", nameEn: "Volotova" });
  });

  it("turns a platform outside any stop_area into its own stop", () => {
    expect(network.platforms.find((platform) => platform.osmId === "node/5426386888")?.stopOsmId).toBe("node/5426386888");
    expect(network.stops.find((stop) => stop.osmId === "node/5426386888")).toEqual({ osmId: "node/5426386888", nameRu: "Улица Лесная", nameEn: "Ulitsa Lesnaya" });
  });

  it("creates each stop and platform once", () => {
    const ids = (items: { osmId: string }[]) => new Set(items.map((item) => item.osmId)).size;

    expect(ids(network.stops)).toBe(network.stops.length);
    expect(ids(network.platforms)).toBe(network.platforms.length);
  });

  it("draws a direction path along its ways", () => {
    expect(direction("relation/7911648").path.length).toBeGreaterThan(100);
  });
});

describe("mapNetwork on hand-made elements", () => {
  const elements: OsmElement[] = [
    { type: "relation", id: 1, tags: { type: "route", route: "bus", ref: "7" }, members: [
      { type: "node", ref: 10, role: "platform" },
      { type: "way", ref: 20, role: "" },
      { type: "way", ref: 21, role: "" },
      { type: "way", ref: 11, role: "platform_exit_only" },
    ] },
    { type: "relation", id: 2, tags: { public_transport: "stop_area", name: "Вакзал", "name:en": "Railway Station" }, members: [
      { type: "node", ref: 10, role: "platform" },
    ] },
    { type: "node", id: 10, lat: 52.4, lon: 31.0, tags: { name: "Вакзал" } },
    { type: "way", id: 11, tags: { name: "Рынак", "name:ru": "Рынок" }, geometry: [
      { lat: 52.0, lon: 31.0 }, { lat: 52.0, lon: 31.2 }, { lat: 52.2, lon: 31.2 }, { lat: 52.2, lon: 31.0 }, { lat: 52.0, lon: 31.0 },
    ] },
    { type: "way", id: 20, geometry: [{ lat: 1, lon: 1 }, { lat: 0, lon: 0 }] },
    { type: "way", id: 21, geometry: [{ lat: 2, lon: 2 }, { lat: 1, lon: 1 }] },
  ];

  it("joins ways into one polyline whatever way they point", () => {
    const [{ directions: [direction] }] = mapNetwork(elements).routes;

    expect(direction.path).toEqual([[0, 0], [1, 1], [2, 2]]);
  });

  it("puts a way platform at its centroid", () => {
    const platform = mapNetwork(elements).platforms.find((candidate) => candidate.osmId === "way/11")!;

    expect(platform.stopOsmId).toBe("way/11");
    expect(platform.latitude).toBeCloseTo(52.1);
    expect(platform.longitude).toBeCloseTo(31.1);
  });

  it("names stops from name when name:ru is absent and takes name:en from OSM", () => {
    expect(mapNetwork(elements).stops).toEqual([
      { osmId: "relation/2", nameRu: "Вакзал", nameEn: "Railway Station" },
      { osmId: "way/11", nameRu: "Рынок", nameEn: "Rynok" },
    ]);
  });

  it("groups routes outside any route_master by mode and number", () => {
    expect(mapNetwork(elements).routes.map((route) => route.osmId)).toEqual(["bus/7"]);
  });

  it("names a stop after its platform when the stop_area has no name", () => {
    const unnamedArea: OsmElement[] = [
      { type: "relation", id: 1, tags: { type: "route", route: "bus", ref: "7" }, members: [{ type: "node", ref: 10, role: "platform" }] },
      { type: "relation", id: 2, tags: { public_transport: "stop_area" }, members: [{ type: "node", ref: 10, role: "platform" }] },
      { type: "node", id: 10, lat: 52.4, lon: 31.0, tags: { "name:ru": "Вокзал" } },
    ];

    expect(mapNetwork(unnamedArea).stops).toEqual([{ osmId: "relation/2", nameRu: "Вокзал", nameEn: "Vokzal" }]);
  });
});
