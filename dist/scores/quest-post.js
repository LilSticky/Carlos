import { cut } from "../cards/format.js";
import { adDay, dayList, DAY_LABELS, serverClock, SERVER_OFFSET_MS } from "./days.js";
import { points, QUEST_COLOR } from "./scores.js";
/** The post goes out from this hour of the server day on (10:00 server time = 12:00 UTC). */
export const QUEST_POST_HOUR = 10;
/**
 * The repeating quests that should be posted now: they run today, it is past the post hour, not posted yet.
 * `anyHour`: also before the post hour (riding along with the KvK vote card).
 */
export function dueQuests(s, now, posted, anyHour = false) {
    const clock = serverClock(now);
    if ((s.today && s.today !== clock.day) || (!anyHour && clock.hour < QUEST_POST_HOUR))
        return [];
    return s.quests
        .filter((q) => q.runsToday && q.days && q.quest)
        .map((q) => ({ key: questKey(clock.day, q.quest), quest: q, day: clock.day }))
        .filter((x) => !posted(x.key));
}
export const questKey = (day, quest) => `${day}|${quest}`;
function reward(q, barracks) {
    const parts = [];
    if (q.bonus)
        parts.push(`**+${points(q.bonus)} points** for every new report that fits`);
    if (q.multiplier && q.multiplier !== 1)
        parts.push(`**x${points(q.multiplier)}** on the points of every report that fits`);
    if (!parts.length)
        return "";
    const board = q.board ? ` on the ${q.board} Scoreboard` : "";
    return barracks
        ? `**+${points(q.bonus ?? 0)} points**${board} today, on top of the 5 every Barracks screenshot earns. One per day counts.`
        : `${parts.join(", ")}${board}, today only.`;
}
/** The announcement for quest `q` on server date `day`; `uploadChannelId` is where members post screenshots. */
export function questEmbed(q, day, uploadChannelId) {
    const upload = `<#${uploadChannelId}>`;
    const today = DAY_LABELS[adDay(day)];
    const barracks = q.type.toLowerCase() === "barracks" && !!q.bonus;
    const [y, m, d] = day.split("-").map(Number);
    const end = Math.floor((Date.UTC(y, m - 1, d + 1) - SERVER_OFFSET_MS) / 1000); // 24:00 server time
    const fields = [];
    const pay = reward(q, barracks);
    if (pay)
        fields.push({ name: "Reward", value: cut(pay, 1024) });
    fields.push({ name: "Open until", value: `End of the server day: <t:${end}:t> your time (<t:${end}:R>)` });
    const repeat = dayList(q.days);
    const footer = barracks
        ? `Every ${repeat || "week"}. Half-empty barracks count too: better we know now than mid-fight.`
        : repeat ? `Every ${repeat}.` : "";
    return {
        title: cut(barracks ? `Combat readiness check - ${today}` : `${q.quest} - ${today}`, 256),
        color: QUEST_COLOR,
        description: cut(barracks
            ? `How ready for battle are your troops? Show us: post a screenshot of your **Barracks** window ` +
                `(your soldiers per tier) in ${upload}.\n\nThe Battle planner then works with your real soldier count ` +
                `instead of a guess, and a fresh screenshot keeps it right for the next days.`
            : q.note || `The officers want ${q.type ? `${q.type} reports` : "intel"} today. Post them in ${upload}.`, 4096),
        fields,
        ...(footer ? { footer: { text: footer } } : {}),
    };
}
//# sourceMappingURL=quest-post.js.map