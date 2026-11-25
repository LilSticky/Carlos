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
    /** The set-up window in milliseconds since 1970, so Discord shows it in each reader's own time. */
    fromAt: z.number().optional().catch(undefined),
    byAt: z.number().optional().catch(undefined),
});
export const scheduleData = z.object({ boarding: text, days: z.array(day).min(1) });
/** The schedule's green, as in the sheet. */
export const SCHEDULE_COLOR = 0x2e7d32;
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
const DAYS_IN_WEEK = 7;
/** "Day IV" or "Rest Day", the way the Alliance Duel counts. */
export function dayName(index) {
    return index >= DAYS_IN_WEEK - 1 ? "Rest Day" : `Day ${ROMAN[index] ?? index + 1}`;
}
/** "26.11." from "2026-11-26" (server time). */
function dayMonth(dateFile) {
    const m = /^\d{4}-(\d{2})-(\d{2})/.exec(dateFile);
    return m ? `${m[2]}.${m[1]}.` : "";
}
/** A Discord timestamp: shown in each reader's own time zone. `t`: 18:00, `R`: in 3 hours. */
export const stamp = (ms, style) => `<t:${Math.floor(ms / 1000)}:${style}>`;
/** "Set-up 17:30-18:00" in the reader's time, when the sheet sends the moments; else the sheet's text on new times. */
function setupLine(d, next) {
    if (d.fromAt === undefined || d.byAt === undefined)
        return d.time.changed ? `Set-up **${d.time.text}** (new time)` : undefined;
    return `Set-up **${stamp(d.fromAt, "t")}-${stamp(d.byAt, "t")}**${d.time.changed ? " (new time)" : ""}${next ? ` · ${stamp(d.fromAt, "R")}` : ""}`;
}
const slot = (name, backup) => (name ? `**${name}**` : "*not set yet*") + (backup ? ` · backup ${backup}` : "");
function dayField(d, next) {
    const date = dayMonth(d.dateFile);
    const head = [dayName(d.index), date, next ? "next stop" : ""].filter(Boolean).join(" · ");
    const lines = [];
    const setup = setupLine(d, next);
    if (setup)
        lines.push(setup);
    if (d.mvp) {
        const chip = d.ways.map((w) => w.chip).filter(Boolean).join(" + ") || "MVP";
        lines.push(`MVP coach: ${slot(d.coach, "")} · ${chip.toLowerCase().replace(/^./, (c) => c.toUpperCase())}`);
        if (d.tag)
            lines.push(`*${d.tag}*`);
    }
    else {
        lines.push(`Coach: ${slot(d.coach, d.coachBackup)}`);
    }
    if (d.guard)
        lines.push(`${d.trial ? "Guard on trial" : "Guard"}: ${slot(d.guard, d.guardBackup)}`);
    return { name: cut(head, 256), value: cut(lines.join("\n"), 1024) };
}
/** The card: one field per day still to come, the next stop first. */
export function scheduleEmbed(data) {
    const whole = data.days.length >= DAYS_IN_WEEK;
    // with moments every day shows its own set-up time in the reader's time; the sheet's line names only server time
    const own = data.days.every((d) => d.fromAt !== undefined && d.byAt !== undefined);
    const intro = own ? "Set-up times are in your own time." : data.boarding ? `${data.boarding}.` : "";
    return {
        title: "Coachman Express",
        description: [intro, whole ? "This week's timetable:" : "Still to come this week:"]
            .filter(Boolean)
            .join("\n"),
        color: SCHEDULE_COLOR,
        fields: data.days.map((d, i) => dayField(d, i === 0)),
        footer: { text: "Day or time doesn't work for you, or not sure how to drive? Tell an R4. /faq has the driver guide." },
    };
}
//# sourceMappingURL=schedule.js.map