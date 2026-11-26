import { z } from "zod";
import { cut } from "../cards/format.js";
import { SCHEDULE_COLOR, dayName, stamp } from "../cards/schedule.js";
/**
 * The daily caravan post: a card for the next stop of the Coachman Express (BotActions.js, action "daily"), posted
 * once a day in the announcement channel some hours before set-up, without @here. Times are Discord timestamps, so
 * every reader sees them in their own time. The driver is mentioned when their Discord account is linked to their name.
 */
const text = z.string().catch("");
const answer = z.object({
    /** The in-game chat line; the card does not show it (it names server time only). */
    text: z.string().min(1),
    /** The day of the stop, yyyy-mm-dd: one post per day. */
    day: z.string().min(1),
    coach: text,
    fromAt: z.number(),
    byAt: z.number(),
    /** Sent by newer sheets only: 0 = Day I, 6 = Rest Day. */
    index: z.number().int().min(0).optional().catch(undefined),
    guard: text,
    mvp: z.boolean().catch(false),
    tag: text,
    /** Another set-up time than usual. */
    changed: z.boolean().catch(false),
});
export function readDaily(raw) {
    const r = answer.safeParse(raw);
    return r.success ? r.data : undefined;
}
/** How long before set-up starts the post goes out. */
export const DAILY_LEAD_MS = 3 * 3600_000;
/** True when the day's post is due: from DAILY_LEAD_MS before set-up until boarding, and not posted yet. */
export function dailyDue(daily, posted, now) {
    const t = now.getTime();
    return !posted && t >= daily.fromAt - DAILY_LEAD_MS && t < daily.byAt;
}
/** "26.11." from "2026-11-26" (server time). */
function dayMonth(day) {
    const m = /^\d{4}-(\d{2})-(\d{2})/.exec(day);
    return m ? `${m[2]}.${m[1]}.` : "";
}
/** The card: who drives, the set-up window and boarding in the reader's own time, counting down. */
export function dailyEmbed(daily, driverId) {
    const driver = driverId ? `<@${driverId}>` : `**${daily.coach}**`;
    const head = [daily.index === undefined ? "" : dayName(daily.index), dayMonth(daily.day)].filter(Boolean).join(" · ");
    const fields = [
        { name: daily.mvp ? "MVP coach" : "Coach", value: cut(driver, 1024), inline: true },
    ];
    if (daily.guard)
        fields.push({ name: "Guard", value: cut(`**${daily.guard}**`, 1024), inline: true });
    fields.push({
        name: daily.changed ? "Set-up (new time)" : "Set-up",
        value: `${stamp(daily.fromAt, "t")}-${stamp(daily.byAt, "t")}\nstarts ${stamp(daily.fromAt, "R")}`,
        inline: false,
    }, { name: "Boarding", value: `${stamp(daily.byAt, "f")}\n${stamp(daily.byAt, "R")}`, inline: false });
    return {
        title: head ? `Coachman Express · ${head}` : "Coachman Express",
        description: cut([`Next stop: ride with ${daily.mvp ? "our MVP " : ""}${driver}.`, daily.mvp && daily.tag ? `*${daily.tag}*` : ""]
            .filter(Boolean)
            .join("\n"), 4096),
        color: SCHEDULE_COLOR,
        fields,
        footer: { text: "Times are in your own time. Drop a ticket for the reroll when you hop on." },
        timestamp: new Date(daily.byAt).toISOString(),
    };
}
/** The post: the card, and the driver mentioned (and pinged) above it when linked. Never @here. */
export function dailyMessage(daily, driverId) {
    const embeds = [dailyEmbed(daily, driverId)];
    return driverId
        ? { content: `<@${driverId}>, you drive the next Coachman Express.`, embeds, users: [driverId] }
        : { embeds, users: [] };
}
//# sourceMappingURL=daily.js.map