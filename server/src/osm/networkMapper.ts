import type { OsmElement } from "./osmSource.ts";
import { transliterate } from "./transliterate.ts";

export type TransportMode = "bus" | "trolleybus";
export type Point = [number, number];

export interface CandidateStop {
  osmId: string;
  nameRu: string;
  nameEn: string;
}

export interface CandidatePlatform {
  osmId: string;
  stopOsmId: string;
  latitude: number;
  longitude: number;
}

export interface CandidateDirection {
  osmId: string;
  platformOsmIds: string[];
  viaStopOsmId: string | null;
  path: Point[];
}

export interface CandidateRoute {
  osmId: string;
  number: string;
  transportMode: TransportMode;
  directions: CandidateDirection[];
}

export type SkipReason = "no_ref" | "regional" | "national" | "international" | "no_platforms";

export interface SkippedRoute {
  ref: string | null;
  reason: SkipReason;
}

export interface CandidateNetwork {
  stops: CandidateStop[];
  platforms: CandidatePlatform[];
  routes: CandidateRoute[];
  skippedRoutes: SkippedRoute[];
}

type Relation = Extract<OsmElement, { type: "relation" }>;
type Way = Extract<OsmElement, { type: "way" }>;

const platformRoles = new Set(["platform", "platform_entry_only", "platform_exit_only"]);
const skippedNetworks = new Set(["regional", "national", "international"]);

const osmId = (type: string, id: number) => `${type}/${id}`;
const samePoint = (a: Point | undefined, b: Point | undefined) => a !== undefined && b !== undefined && a[0] === b[0] && a[1] === b[1];

function joinWays(ways: Point[][]): Point[] {
  const path: Point[] = [];
  ways.forEach((way, index) => {
    const next = ways[index + 1];
    const reversed =
      index === 0 ? next !== undefined && (samePoint(way[0], next[0]) || samePoint(way[0], next.at(-1))) : samePoint(way.at(-1), path.at(-1)) && !samePoint(way[0], path.at(-1));
    const points = reversed ? [...way].reverse() : way;
    path.push(...(samePoint(points[0], path.at(-1)) ? points.slice(1) : points));
  });
  return path;
}

function centroid(way: Way): Point {
  const ring = way.geometry.length > 1 && samePoint([way.geometry[0].lat, way.geometry[0].lon], [way.geometry.at(-1)!.lat, way.geometry.at(-1)!.lon]) ? way.geometry.slice(0, -1) : way.geometry;
  const sum = ring.reduce(([lat, lon], point) => [lat + point.lat, lon + point.lon], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

function assignVia(directions: CandidateDirection[], platforms: Map<string, CandidatePlatform>): void {
  const stopsOf = (direction: CandidateDirection) => direction.platformOsmIds.map((id) => platforms.get(id)!.stopOsmId);
  for (const direction of directions) {
    const stops = stopsOf(direction);
    const twins = directions
      .filter((other) => other !== direction)
      .map(stopsOf)
      .filter((other) => other[0] === stops[0] && other.at(-1) === stops.at(-1));
    if (twins.length > 0) {
      direction.viaStopOsmId = stops.find((stop) => twins.every((twin) => !twin.includes(stop))) ?? null;
    }
  }
}

export function mapNetwork(elements: OsmElement[]): CandidateNetwork {
  const byId = new Map(elements.map((element) => [osmId(element.type, element.id), element]));
  const relations = elements.filter((element): element is Relation => element.type === "relation");
  const masterOf = new Map<number, Relation>();
  const stopAreaOf = new Map<string, Relation>();
  for (const relation of relations) {
    for (const member of relation.members) {
      if (relation.tags?.type === "route_master") {
        masterOf.set(member.ref, relation);
      }
      const memberId = osmId(member.type, member.ref);
      if (relation.tags?.public_transport === "stop_area" && member.role === "platform" && !stopAreaOf.has(memberId)) {
        stopAreaOf.set(memberId, relation);
      }
    }
  }

  const stops = new Map<string, CandidateStop>();
  const platforms = new Map<string, CandidatePlatform>();
  const routes = new Map<string, CandidateRoute>();
  const skippedRoutes: SkippedRoute[] = [];
  const skip = (ref: string | null, reason: SkipReason) => {
    if (!skippedRoutes.some((skipped) => skipped.ref === ref && skipped.reason === reason)) {
      skippedRoutes.push({ ref, reason });
    }
  };

  for (const relation of relations.filter((candidate) => candidate.tags?.type === "route")) {
    const tags = relation.tags ?? {};
    const ref = tags.ref ?? null;
    const platformElements = relation.members
      .filter((member) => platformRoles.has(member.role) && member.type !== "relation")
      .map((member) => byId.get(osmId(member.type, member.ref)))
      .filter((element) => element !== undefined && element.type !== "relation");
    if (!ref) {
      skip(null, "no_ref");
      continue;
    }
    if (skippedNetworks.has(tags.network)) {
      skip(ref, tags.network as SkipReason);
      continue;
    }
    if (platformElements.length === 0) {
      skip(ref, "no_platforms");
      continue;
    }

    for (const element of platformElements) {
      const id = osmId(element.type, element.id);
      const area = stopAreaOf.get(id);
      const stopElement = area ?? element;
      const stopOsmId = osmId(stopElement.type, stopElement.id);
      const [latitude, longitude] = element.type === "node" ? [element.lat, element.lon] : centroid(element);
      platforms.set(id, { osmId: id, stopOsmId, latitude, longitude });
      if (!stops.has(stopOsmId)) {
        const tags = area?.tags?.["name:ru"] || area?.tags?.name ? area.tags : element.tags;
        const nameRu = tags?.["name:ru"] ?? tags?.name ?? "";
        stops.set(stopOsmId, { osmId: stopOsmId, nameRu, nameEn: tags?.["name:en"] ?? transliterate(nameRu) });
      }
    }

    const ways = relation.members
      .filter((member) => member.type === "way" && member.role === "")
      .map((member) => byId.get(osmId("way", member.ref)))
      .filter((element): element is Way => element?.type === "way")
      .map((way) => way.geometry.map((point): Point => [point.lat, point.lon]));
    const direction: CandidateDirection = {
      osmId: osmId("relation", relation.id),
      platformOsmIds: platformElements.map((element) => osmId(element.type, element.id)),
      viaStopOsmId: null,
      path: joinWays(ways),
    };

    const master = masterOf.get(relation.id);
    const routeOsmId = master && master.tags?.ref === ref ? osmId("relation", master.id) : `${tags.route}/${ref}`;
    const route = routes.get(routeOsmId) ?? { osmId: routeOsmId, number: ref, transportMode: tags.route as TransportMode, directions: [] };
    route.directions.push(direction);
    routes.set(routeOsmId, route);
  }

  for (const route of routes.values()) {
    assignVia(route.directions, platforms);
  }

  return { stops: [...stops.values()], platforms: [...platforms.values()], routes: [...routes.values()], skippedRoutes };
}
