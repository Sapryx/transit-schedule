import pg from "pg";
import { transaction } from "./database.ts";
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

export interface StopSummary {
  id: number;
  name: Name;
  missingFromOsm: boolean;
}

export type Outcome = "done" | "not_found" | "not_missing_from_osm" | "stop_in_use";

export type Deletable = "routes" | "directions" | "stops";

export interface NetworkAdmin {
  routes(): Promise<RouteSummary[]>;
  route(id: number): Promise<RouteSummary<DirectionDetail> | null>;
  stops(): Promise<StopSummary[]>;
  confirmReview(directionId: number): Promise<Outcome>;
  setWithdrawn(routeId: number, withdrawn: boolean): Promise<Outcome>;
  remove(table: Deletable, id: number): Promise<Outcome>;
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

    async stops() {
      const { rows } = await pool.query<StopSummary>(
        `SELECT id, ${stopName("stops")} AS name, missing_from_osm AS "missingFromOsm" FROM stops ORDER BY name_ru, id`,
      );
      return rows;
    },

    confirmReview(directionId) {
      return transaction(pool, async (client) => {
        const { rowCount } = await client.query("UPDATE directions SET needs_review = false WHERE id = $1", [directionId]);
        if (!rowCount) {
          return "not_found";
        }
        await client.query("UPDATE direction_platforms SET interpolated = false WHERE direction_id = $1", [directionId]);
        return "done";
      });
    },

    async setWithdrawn(routeId, withdrawn) {
      const { rowCount } = await pool.query("UPDATE routes SET withdrawn = $2 WHERE id = $1", [routeId, withdrawn]);
      return rowCount ? "done" : "not_found";
    },

    async remove(table, id) {
      try {
        const { rows } = await pool.query<{ missing: boolean | null }>(
          `WITH target AS (SELECT missing_from_osm FROM ${table} WHERE id = $1),
             deleted AS (DELETE FROM ${table} WHERE id = $1 AND missing_from_osm)
           SELECT (SELECT missing_from_osm FROM target) AS missing`,
          [id],
        );
        return rows[0].missing === null ? "not_found" : rows[0].missing ? "done" : "not_missing_from_osm";
      } catch (error) {
        if (error instanceof pg.DatabaseError && error.code === "23503") {
          return "stop_in_use";
        }
        throw error;
      }
    },
  };
}
