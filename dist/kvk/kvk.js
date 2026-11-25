import { z } from "zod";
import { stamp } from "../siege/siege.js";
const iso = z.string().transform((s, ctx) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
        ctx.addIssue({ code: "custom", message: "not a time" });
    return d;
});
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nextAnswer = z.object({
    day,
    inviteAt: iso,
    closeAt: iso,
    battleAt: iso,
    open: z.boolean(),
    yes: z.array(z.string()),
    no: z.array(z.string()),
    members: z.number(),
});
export function readKvkNext(raw) {
    const p = nextAnswer.safeParse(raw);
    return p.success ? p.data : undefined;
}
const answerAnswer = z.object({ day, vote: z.enum(["Yes", "No"]), changed: z.boolean(), yes: z.array(z.string()), no: z.array(z.string()) });
export function readKvkAnswer(raw) {
    const p = answerAnswer.safeParse(raw);
    return p.success ? p.data : undefined;
}
const group = z.object({ count: z.number(), might: z.number(), level: z.number() });
const readinessAnswer = z.object({
    day,
    battleAt: iso,
    battleTime: z.string(),
    yes: group,
    no: group,
    maybe: group,
    fromDiscord: z.number(),
    brackets: z.array(z.object({ name: z.string(), count: z.number(), might: z.number() })),
    strongest: z.array(z.object({ name: z.string(), might: z.number() })),
    readiness: z.object({ min: z.number(), likely: group, unknown: z.number(), bled: z.array(z.string()) }).nullable(),
    noAnswer: z.array(z.string()),
});
export function readKvkReadiness(raw) {
    const p = readinessAnswer.safeParse(raw);
    return p.success ? p.data : undefined;
}
/** How long after Day VI starts a missed readiness card is still posted: until the battle is over. */
export const READINESS_GRACE_MS = 18 * 3600_000;
/** What is due now: the vote card from its time while the vote is open, the readiness card once it closed. */
export function kvkDue(next, posts, now) {
    const t = now.getTime();
    if (!posts.readinessPosted && t >= next.closeAt.getTime() && t < next.closeAt.getTime() + READINESS_GRACE_MS)
        return "readiness";
    if (!posts.inviteMessageId && t >= next.inviteAt.getTime() && t < next.closeAt.getTime())
        return "invite";
    return null;
}
export const KVK_YES = "kvk-yes:";
export const KVK_NO = "kvk-no:";
const GREEN = 0x356854;
function names(list, max = 1000) {
    if (!list.length)
        return "Nobody yet.";
    let out = "";
    for (const [i, n] of list.entries()) {
        const next = (out ? out + ", " : "") + n;
        if (next.length > max)
            return `${out} and ${list.length - i} more`;
        out = next;
    }
    return out;
}
/** "56.1M" */
export function millions(n) {
    return `${(n / 1e6).toFixed(1)}M`;
}
/** The answer lists of the vote card. */
export function voteFields(yes, no) {
    return [
        { name: `Participate (${yes.length})`, value: names(yes) },
        { name: `Stay out (${no.length})`, value: names(no) },
    ];
}
/** The vote card; `closed` once Day VI started. */
export function kvkInviteEmbed(next, closed = false) {
    return {
        title: "KvK: Royal City battle on Day VI",
        color: GREEN,
        description: closed
            ? "The vote is closed. The KvK Readiness card is posted below."
            : [
                `The battle starts at ${stamp(next.battleAt)} on ${stamp(next.battleAt, "F")}.`,
                "Will you make it? Press **Participate** or **Stay out**. You can change your answer until Day VI starts " +
                    `(${stamp(next.closeAt, "R")}).`,
                "Your answer here counts over the in-game vote. Please vote in game too: it shows your Might.",
            ].join("\n\n"),
        fields: voteFields(next.yes, next.no),
    };
}
/** The KvK Readiness card: the vote and the battle strength in short. */
export function readinessEmbed(r) {
    const lines = [
        `Battle at ${stamp(r.battleAt)} (${stamp(r.battleAt, "R")}).`,
        "",
        `**Participate: ${r.yes.count}** · ${millions(r.yes.might)} Might`,
        `Stay out: ${r.no.count} · ${millions(r.no.might)} Might`,
        `No answer: ${r.maybe.count} · ${millions(r.maybe.might)} Might`,
    ];
    const fields = [];
    if (r.readiness) {
        const ready = r.readiness;
        fields.push({
            name: "Likely to fight",
            value: `${ready.likely.count} of ${r.yes.count} · ${millions(ready.likely.might)} Might (readiness ${ready.min} or more)` +
                (ready.unknown ? `\nNo readiness known for ${ready.unknown}.` : ""),
        });
    }
    const brackets = r.brackets.filter((b) => b.count);
    if (brackets.length) {
        fields.push({ name: "Participants by level", value: brackets.map((b) => `${b.name}: ${b.count} · ${millions(b.might)}`).join("\n"), inline: true });
    }
    if (r.strongest.length) {
        fields.push({ name: "Strongest", value: r.strongest.map((s) => `${s.name} ${millions(s.might)}`).join("\n"), inline: true });
    }
    if (r.readiness?.bled.length) {
        fields.push({ name: "Heal or shield before the battle", value: names(r.readiness.bled, 1000) });
    }
    return {
        title: "KvK Readiness",
        color: GREEN,
        description: lines.join("\n"),
        fields,
        footer: {
            text: `Day VI ${r.day}, ${r.battleTime} server time. ${r.fromDiscord} answers from Discord, the rest from the in-game vote. Average level of participants: ${r.yes.level || "-"}.`,
        },
    };
}
//# sourceMappingURL=kvk.js.map