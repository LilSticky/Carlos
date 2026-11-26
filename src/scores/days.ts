/** Server time and the days of the AD week (Day I = Monday, Rest Day = Sunday, server time). */

/** The game's server runs on UTC-2 all year. */
export const SERVER_OFFSET_MS = -2 * 3600_000;
export const DAY_LABELS = ["", "Day I", "Day II", "Day III", "Day IV", "Day V", "Day VI", "Rest Day"];
const DAY_WORDS: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, rest: 7, r: 7, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7 };

/** The server date ("2026-11-26") and hour of a moment. */
export function serverClock(now: Date): { day: string; hour: number } {
  const s = new Date(now.getTime() + SERVER_OFFSET_MS);
  return { day: s.toISOString().slice(0, 10), hour: s.getUTCHours() };
}

/** The day of the AD week of a server date: 1 (Day I, Monday) to 7 (Rest Day, Sunday). */
export function adDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() || 7;
}

/** "IV, Rest Day" -> "Day IV and Rest Day", in week order; "" when no day is readable. */
export function dayList(days: string): string {
  const found = new Set<number>();
  for (const w of days.toLowerCase().replace(/\bday\b/g, " ").split(/[,;/\s]+/)) if (DAY_WORDS[w]) found.add(DAY_WORDS[w]!);
  const labels = [...found].sort((a, b) => a - b).map((n) => DAY_LABELS[n]!);
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : (labels[0] ?? "");
}
