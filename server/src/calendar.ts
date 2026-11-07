import type pg from "pg";
import type { Clock } from "./clock.ts";

export type DayType = "weekday" | "weekend";

export interface DayInfo {
  date: string;
  dayType: DayType;
  holiday: boolean;
}

export interface Calendar {
  today(): string;
  dayInfo(date: string): Promise<DayInfo>;
  holidays(includePast: boolean): Promise<string[]>;
  addHoliday(date: string): Promise<boolean>;
  removeHoliday(date: string): Promise<boolean>;
  seedHolidays(): Promise<void>;
}

const minskDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Minsk" });

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const time = utcDate(value).getTime();
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

const julianToGregorianDays = 13;
const radunitsaDaysAfterEaster = 9;

function radunitsa(year: number): string {
  const d = (19 * (year % 19) + 15) % 30;
  const e = (2 * (year % 4) + 4 * (year % 7) - d + 34) % 7;
  const julianEaster = new Date(Date.UTC(year, Math.floor((d + e + 114) / 31) - 1, ((d + e + 114) % 31) + 1));
  return addDays(julianEaster, julianToGregorianDays + radunitsaDaysAfterEaster);
}

export function belarusPublicHolidays(year: number): string[] {
  const fixed = ["01-01", "01-02", "01-07", "03-08", "05-01", "05-09", "07-03", "11-07", "12-25"];
  return [...fixed.map((day) => `${year}-${day}`), radunitsa(year)].sort();
}

export function createCalendar({ pool, clock }: { pool: pg.Pool; clock: Clock }): Calendar {
  const today = () => minskDate.format(clock.now());

  return {
    today,

    async dayInfo(date) {
      const { rowCount } = await pool.query("SELECT 1 FROM holidays WHERE date = $1", [date]);
      const holiday = rowCount === 1;
      const weekend = holiday || [0, 6].includes(utcDate(date).getUTCDay());
      return { date, dayType: weekend ? "weekend" : "weekday", holiday };
    },

    async holidays(includePast) {
      const { rows } = await pool.query<{ date: string }>(
        "SELECT to_char(date, 'YYYY-MM-DD') AS date FROM holidays WHERE $1 OR date >= $2 ORDER BY date",
        [includePast, today()],
      );
      return rows.map((row) => row.date);
    },

    async addHoliday(date) {
      const { rowCount } = await pool.query("INSERT INTO holidays (date) VALUES ($1) ON CONFLICT DO NOTHING", [date]);
      return rowCount === 1;
    },

    async removeHoliday(date) {
      const { rowCount } = await pool.query("DELETE FROM holidays WHERE date = $1", [date]);
      return rowCount === 1;
    },

    async seedHolidays() {
      const year = Number(today().slice(0, 4));
      const dates = [...belarusPublicHolidays(year), ...belarusPublicHolidays(year + 1)];
      await pool.query(
        "INSERT INTO holidays (date) SELECT unnest($1::date[]) WHERE NOT EXISTS (SELECT 1 FROM holidays)",
        [dates],
      );
    },
  };
}
