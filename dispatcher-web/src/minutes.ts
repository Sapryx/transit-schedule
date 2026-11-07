const pad = (value: number) => String(value).padStart(2, "0");

export const formatTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export function parseTime(text: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(text.trim());
  const minutes = match ? Number(match[1]) * 60 + Number(match[2]) : null;
  return minutes !== null && minutes < 48 * 60 ? minutes : null;
}

export const parseWholeMinutes = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : null);
