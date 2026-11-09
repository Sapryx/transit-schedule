import type { Calendar, DayType } from "./calendar.ts";

export interface DatedDayType {
  midnight: number;
  dayType: DayType;
}

export const minute = 60_000;
const day = 1440 * minute;
const minskOffset = 180 * minute;

const minskDate = (time: number) => new Date(time + minskOffset).toISOString().slice(0, 10);

const minskMidnight = (date: string) => Date.parse(`${date}T00:00:00.000Z`) - minskOffset;

export const minskTime = (time: number) => `${new Date(time + minskOffset).toISOString().slice(0, 19)}+03:00`;

export function dayTypesAround(calendar: Calendar, time: number): Promise<DatedDayType[]> {
  return Promise.all(
    [-1, 0, 1].map(async (shift) => {
      const date = minskDate(time + shift * day);
      return { midnight: minskMidnight(date), dayType: (await calendar.dayInfo(date)).dayType };
    }),
  );
}
