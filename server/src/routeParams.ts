import { isDate } from "./calendar.ts";

export const isId = (value: string) => /^[1-9]\d{0,8}$/.test(value);

const dateTime = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;

export function parseDateTime(value: unknown): Date | null {
  const match = typeof value === "string" ? dateTime.exec(value) : null;
  return match && isDate(match[1]) ? new Date(match[0]) : null;
}
