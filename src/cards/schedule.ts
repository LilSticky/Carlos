import type { APIEmbed, APIEmbedField } from "discord.js";
import { z } from "zod";
import { cut } from "./format.js";

/**
 * /rotation: the weekly coachman schedule as a card. The Coachman Express sends the days it draws its schedule image
 * from (BotActions.js, action "schedule": boarding and days); Carlos only lays them out.
 */
const text = z.string().catch("");
const day = z.object({
  index: z.number().int().min(0),
  dateFile: text,
  coach: text,
  coachBackup: text,
  guard: text,
  guardBackup: text,
  mvp: z.boolean().catch(false),
  tag: text,
  ways: z.array(z.object({ chip: text })).catch([]),
  trial: z.boolean().catch(false),
  time: z.object({ text, changed: z.boolean().catch(false) }).catch({ text: "", changed: false }),
});
export const scheduleData = z.object({ boarding: text, days: z.array(day).min(1) });
export type ScheduleData = z.infer<typeof scheduleData>;
type Day = ScheduleData["days"][number];

/** The schedule's green, as in the sheet. */
export const SCHEDULE_COLOR = 0x2e7d32;
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
const DAYS_IN_WEEK = 7;

/** "Day IV" or "Rest Day", the way the Alliance Duel counts. */
export function dayName(index: number): string {
  return index >= DAYS_IN_WEEK - 1 ? "Rest Day" : `Day ${ROMAN[index] ?? index + 1}`;
}

/** "26.11." from "2026-11-26" (server time). */
function dayMonth(dateFile: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(dateFile);
  return m ? `${m[2]}.${m[1]}.` : "";
}

const slot = (name: string, backup: string) => (name ? `**${name}**` : "*not set yet*") + (backup ? ` · backup ${backup}` : "");

function dayField(d: Day, next: boolean): APIEmbedField {
  const date = dayMonth(d.dateFile);
  const head = [dayName(d.index), date, next ? "next stop" : ""].filter(Boolean).join(" · ");
  const lines: string[] = [];
  if (d.time.changed) lines.push(`Set-up **${d.time.text}** (new time)`);
  if (d.mvp) {
    const chip = d.ways.map((w) => w.chip).filter(Boolean).join(" + ") || "MVP";
    lines.push(`MVP coach: ${slot(d.coach, "")} · ${chip.toLowerCase().replace(/^./, (c) => c.toUpperCase())}`);
    if (d.tag) lines.push(`*${d.tag}*`);
  } else {
    lines.push(`Coach: ${slot(d.coach, d.coachBackup)}`);
  }
  if (d.guard) lines.push(`${d.trial ? "Guard on trial" : "Guard"}: ${slot(d.guard, d.guardBackup)}`);
  return { name: cut(head, 256), value: cut(lines.join("\n"), 1024) };
}

/** The card: one field per day still to come, the next stop first. */
export function scheduleEmbed(data: ScheduleData): APIEmbed {
  const whole = data.days.length >= DAYS_IN_WEEK;
  return {
    title: "Coachman Express",
    description: [data.boarding ? `${data.boarding}.` : "", whole ? "This week's timetable:" : "Still to come this week:"]
      .filter(Boolean)
      .join("\n"),
    color: SCHEDULE_COLOR,
    fields: data.days.map((d, i) => dayField(d, i === 0)),
    footer: { text: "Day or time doesn't work for you, or not sure how to drive? Tell an R4. /faq has the driver guide." },
  };
}
