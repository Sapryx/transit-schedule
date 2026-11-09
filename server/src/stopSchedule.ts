import type pg from "pg";
import type { Calendar, DayType } from "./calendar.ts";
import type { Clock } from "./clock.ts";
import { directionName, type DirectionName } from "./networkSql.ts";
import type { TransportMode } from "./osm/networkMapper.ts";
import { byNumber, localDirectionName, visible, type Language } from "./passengerNetwork.ts";
import { dayTypesAround, minskTime, minute } from "./minskTime.ts";

export interface StopScheduleEntry {
  routeId: number;
  number: string;
  mode: TransportMode;
  directionId: number;
  directionName: string;
  arrivals: number[];
}

export interface UpcomingArrival extends Omit<StopScheduleEntry, "arrivals"> {
  arrival: string;
  minutesUntil: number;
}

export interface StopSchedule {
  schedule(stopId: number, dayType: DayType, language: Language): Promise<StopScheduleEntry[] | null>;
  upcoming(stopId: number, at: Date | undefined, limit: number, language: Language): Promise<UpcomingArrival[] | null>;
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

type Ordered = Pick<StopScheduleEntry, "mode" | "number" | "directionId">;

const byEntry = (a: Ordered, b: Ordered) => a.mode.localeCompare(b.mode) || byNumber.compare(a.number, b.number) || a.directionId - b.directionId;

const windowMinutes = 180;

export function createStopSchedule({ pool, calendar, clock }: { pool: pg.Pool; calendar: Calendar; clock: Clock }): StopSchedule {
  async function schedule(stopId: number, dayType: DayType, language: Language) {
    const { rows } = await pool.query<Row>(scheduleQuery, [stopId, dayType]);
    if (!rows.length) {
      return null;
    }
    return rows.map((row) => ({ ...row, directionName: localDirectionName(row.directionName, language) })).sort(byEntry);
  }

  return {
    schedule,

    async upcoming(stopId, at = clock.now(), limit, language) {
      const start = at.getTime();
      const end = start + windowMinutes * minute;
      const days = await dayTypesAround(calendar, start);
      const schedules = new Map(
        await Promise.all([...new Set(days.map(({ dayType }) => dayType))].map(async (dayType) => [dayType, await schedule(stopId, dayType, language)] as const)),
      );
      if (![...schedules.values()].some(Boolean)) {
        return null;
      }
      return days
        .flatMap(({ midnight, dayType }) =>
          (schedules.get(dayType) ?? []).flatMap(({ arrivals, ...entry }) =>
            arrivals.map((minutes) => ({ entry, time: midnight + minutes * minute })),
          ),
        )
        .filter(({ time }) => time >= start && time <= end)
        .sort((a, b) => a.time - b.time || byEntry(a.entry, b.entry))
        .slice(0, limit)
        .map(({ entry, time }) => ({ ...entry, arrival: minskTime(time), minutesUntil: Math.floor((time - start) / minute) }));
    },
  };
}
