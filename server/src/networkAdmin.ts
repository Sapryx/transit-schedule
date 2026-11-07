import type pg from "pg";
import type { Point, TransportMode } from "./osm/networkMapper.ts";

interface Name {
  ru: string;
  en: string;
}

export interface DirectionSummary {
  id: number;
  name: { from: Name; to: Name; via: Name | null };
  scheduled: boolean;
  needsReview: boolean;
  missingFromOsm: boolean;
}

export interface RouteSummary<D = DirectionSummary> {
  id: number;
  number: string;
  mode: TransportMode;
  withdrawn: boolean;
  missingFromOsm: boolean;
  directions: D[];
}

export interface DirectionPlatform {
  platformId: number;
  stopId: number;
  stopName: Name;
  lat: number;
  lon: number;
  travelOffset: number | null;
  interpolated: boolean;
}

export interface DirectionDetail extends DirectionSummary {
  platforms: DirectionPlatform[];
  departures: { weekday: number[]; weekend: number[] };
  path: Point[];
}

export interface NetworkAdmin {
  routes(): Promise<RouteSummary[]>;
  route(id: number): Promise<RouteSummary<DirectionDetail> | null>;
}

const stopName = (stop: string) => `json_build_object('ru', ${stop}.name_ru, 'en', ${stop}.name_en)`;

const endStop = (order: "ASC" | "DESC") => `(
  SELECT ${stopName("s")} FROM direction_platforms dp JOIN platforms p ON p.id = dp.platform_id JOIN stops s ON s.id = p.stop_id
  WHERE dp.direction_id = d.id ORDER BY dp.position ${order} LIMIT 1)`;

const departures = (dayType: string) =>
  `COALESCE((SELECT json_agg(minutes ORDER BY minutes) FROM departures WHERE direction_id = d.id AND day_type = '${dayType}'), '[]')`;

const directionSummary = `
  'id', d.id,
  'name', json_build_object('from', ${endStop("ASC")}, 'to', ${endStop("DESC")}, 'via', (SELECT ${stopName("v")} FROM stops v WHERE v.id = d.via_stop_id)),
  'scheduled', EXISTS (SELECT FROM departures WHERE direction_id = d.id)
    AND NOT EXISTS (SELECT FROM direction_platforms WHERE direction_id = d.id AND travel_offset IS NULL),
  'needsReview', d.needs_review,
  'missingFromOsm', d.missing_from_osm`;

const directionDetail = `${directionSummary},
  'platforms', (
    SELECT json_agg(json_build_object(
      'platformId', p.id, 'stopId', s.id, 'stopName', ${stopName("s")}, 'lat', p.latitude, 'lon', p.longitude,
      'travelOffset', dp.travel_offset, 'interpolated', dp.interpolated) ORDER BY dp.position)
    FROM direction_platforms dp JOIN platforms p ON p.id = dp.platform_id JOIN stops s ON s.id = p.stop_id
    WHERE dp.direction_id = d.id),
  'departures', json_build_object('weekday', ${departures("weekday")}, 'weekend', ${departures("weekend")}),
  'path', d.path`;

const routeQuery = (direction: string, where: string) => `
  SELECT r.id, r.number, r.transport_mode AS mode, r.withdrawn, r.missing_from_osm AS "missingFromOsm",
    COALESCE((SELECT json_agg(json_build_object(${direction}) ORDER BY d.id) FROM directions d WHERE d.route_id = r.id), '[]') AS directions
  FROM routes r ${where} ORDER BY r.id`;

export function createNetworkAdmin({ pool }: { pool: pg.Pool }): NetworkAdmin {
  return {
    async routes() {
      return (await pool.query<RouteSummary>(routeQuery(directionSummary, ""))).rows;
    },

    async route(id) {
      const { rows } = await pool.query<RouteSummary<DirectionDetail>>(routeQuery(directionDetail, "WHERE r.id = $1"), [id]);
      return rows[0] ?? null;
    },
  };
}
