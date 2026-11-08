import type pg from "pg";
import type { DayType } from "./calendar.ts";
import { directionName, type DirectionName } from "./networkSql.ts";
import type { TransportMode } from "./osm/networkMapper.ts";
import { byNumber, localDirectionName, visible, type Language } from "./passengerNetwork.ts";

export interface StopScheduleEntry {
  routeId: number;
  number: string;
  mode: TransportMode;
  directionId: number;
  directionName: string;
  arrivals: number[];
}

export interface StopSchedule {
  schedule(stopId: number, dayType: DayType, language: Language): Promise<StopScheduleEntry[] | null>;
}

type Row = Omit<StopScheduleEntry, "directionName"> & { directionName: DirectionName };

const scheduleQuery = `
  WITH visible AS (${visible})
  SELECT r.id AS "routeId", r.number, r.transport_mode AS mode, d.id AS "directionId", ${directionName} AS "directionName",
    (SELECT coalesce(json_agg(dep.minutes + dp.travel_offset ORDER BY dep.minutes + dp.travel_offset), '[]')
      FROM direction_platforms dp JOIN platforms p ON p.id = dp.platform_id
      JOIN departures dep ON dep.direction_id = d.id AND dep.day_type = $2
      WHERE dp.direction_id = d.id AND p.stop_id = $1) AS arrivals
  FROM routes r JOIN directions d ON d.route_id = r.id
  WHERE d.id IN (SELECT direction_id FROM visible WHERE stop_id = $1)`;

const byEntry = (a: StopScheduleEntry, b: StopScheduleEntry) => a.mode.localeCompare(b.mode) || byNumber.compare(a.number, b.number) || a.directionId - b.directionId;

export function createStopSchedule({ pool }: { pool: pg.Pool }): StopSchedule {
  return {
    async schedule(stopId, dayType, language) {
      const { rows } = await pool.query<Row>(scheduleQuery, [stopId, dayType]);
      if (!rows.length) {
        return null;
      }
      return rows.map((row) => ({ ...row, directionName: localDirectionName(row.directionName, language) })).sort(byEntry);
    },
  };
}
