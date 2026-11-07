import type pg from "pg";
import type { DayType } from "./calendar.ts";
import { transaction } from "./database.ts";

export type ScheduleResult<E extends string> = "ok" | "not_found" | E;

export interface Schedule {
  setTravelOffsets(directionId: number, offsets: unknown): Promise<ScheduleResult<"invalid_travel_offsets">>;
  setDepartures(directionId: number, departures: unknown): Promise<ScheduleResult<"invalid_departures">>;
}

const dayTypes: DayType[] = ["weekday", "weekend"];

const isMinutes = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < 2880;

const isMinuteList = (value: unknown): value is number[] => Array.isArray(value) && value.every(isMinutes);

function isTravelOffsets(value: unknown, platformCount: number): value is number[] {
  return isMinuteList(value) && value.length === platformCount && value[0] === 0 && value.every((offset, index) => index === 0 || offset >= value[index - 1]);
}

function isDepartures(value: unknown): value is Record<DayType, number[]> {
  return (
    typeof value === "object" &&
    value !== null &&
    dayTypes.every((dayType) => {
      const list = (value as Record<string, unknown>)[dayType];
      return isMinuteList(list) && new Set(list).size === list.length;
    })
  );
}

export function createSchedule({ pool }: { pool: pg.Pool }): Schedule {
  return {
    async setTravelOffsets(directionId, offsets) {
      const { rows } = await pool.query<{ count: number }>(
        "SELECT count(dp.position)::int AS count FROM directions d LEFT JOIN direction_platforms dp ON dp.direction_id = d.id WHERE d.id = $1 GROUP BY d.id",
        [directionId],
      );
      if (!rows[0]) {
        return "not_found";
      }
      if (!isTravelOffsets(offsets, rows[0].count)) {
        return "invalid_travel_offsets";
      }
      await pool.query(
        `UPDATE direction_platforms dp SET travel_offset = o.minutes
        FROM (SELECT position, row_number() OVER (ORDER BY position) AS ordinal FROM direction_platforms WHERE direction_id = $1) p
        JOIN unnest($2::int[]) WITH ORDINALITY AS o(minutes, ordinal) ON o.ordinal = p.ordinal
        WHERE dp.direction_id = $1 AND dp.position = p.position`,
        [directionId, offsets],
      );
      return "ok";
    },

    async setDepartures(directionId, departures) {
      if (!(await pool.query("SELECT FROM directions WHERE id = $1", [directionId])).rowCount) {
        return "not_found";
      }
      if (!isDepartures(departures)) {
        return "invalid_departures";
      }
      await transaction(pool, async (client) => {
        await client.query("DELETE FROM departures WHERE direction_id = $1", [directionId]);
        await client.query(
          "INSERT INTO departures (direction_id, day_type, minutes) SELECT $1, * FROM unnest($2::text[], $3::int[])",
          [directionId, dayTypes.flatMap((dayType) => departures[dayType].map(() => dayType)), dayTypes.flatMap((dayType) => departures[dayType])],
        );
      });
      return "ok";
    },
  };
}
