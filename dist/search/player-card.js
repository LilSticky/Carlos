import { z } from "zod";
/**
 * One player as the Coachman Express's player search returns it (searchPlayers, the Player search window). Only the
 * fields Carlos shows; the sheet formats the numbers and dates.
 */
const text = z.coerce.string().catch("");
const player = z.object({
    name: z.string(),
    status: text,
    joined: text,
    left: text.optional(),
    leftReason: text.optional(),
    notes: text,
    squadTop: text.optional(),
    lastAssigned: text,
    queue: text.optional(),
    thisWeek: z.array(text).catch([]),
    min: z.number().catch(0),
    squads: z
        .object({
        date: text,
        age: z.number().nullable().catch(null),
        old: z.boolean().catch(false),
        total: text,
        list: z.array(z.object({
            squad: text,
            might: text,
            heroes: z.array(z.object({ hero: text, level: text, stars: text })).catch([]),
        })),
    })
        .optional()
        .catch(undefined),
    scores: z.array(z.object({ week: text, days: z.array(text), weekly: text, target: z.boolean().catch(false) })).catch([]),
    donations: z.array(z.object({ week: text, amount: text, target: z.boolean().catch(false) })).catch([]),
    minDonation: text,
    donationCheck: z.boolean().catch(false),
    log: z.array(z.object({ date: text, role: text, result: text, reason: text, special: z.boolean().catch(false) })).catch([]),
});
export function readPlayers(raw) {
    const parsed = z.array(player).safeParse(raw);
    return parsed.success ? parsed.data : undefined;
}
const DAY_LABELS = ["I", "II", "III", "IV", "V", "VI"];
const WEEKS = 4;
const num = (s) => Number(s.replace(/[^\d.-]/g, ""));
/**
 * A player's card as Discord Markdown. Notes are the officers' own remarks: only officers see them.
 */
export function playerCard(p, forOfficer) {
    const lines = [`## ${p.name}`, `*${p.status}*`];
    const facts = [];
    if (p.joined)
        facts.push(`Joined ${p.joined}`);
    if (p.left)
        facts.push(`Left ${p.left}${p.leftReason ? ` (${p.leftReason})` : ""}`);
    if (facts.length)
        lines.push(facts.join(" · "));
    if (forOfficer && p.notes)
        lines.push(`Notes: ${p.notes}`);
    if (p.squadTop)
        lines.push(`Top 3 squads: ${p.squadTop}`);
    lines.push(`Last duty: ${p.lastAssigned || "never (in this sheet)"}`);
    if (p.queue)
        lines.push(`Queue: ${p.queue}`);
    if (p.thisWeek.length)
        lines.push(`This week: ${p.thisWeek.join(", ")}`);
    if (p.squads?.list.length) {
        const s = p.squads;
        const age = s.age === null ? "" : `, ${s.age} day${s.age === 1 ? "" : "s"} ago`;
        lines.push("", `**Squads** (screenshot of ${s.date}${age}${s.old ? ", outdated" : ""}${s.total ? `, total Might ${s.total}` : ""})`);
        for (const q of s.list) {
            const heroes = q.heroes.map((h) => `${h.hero} ${h.level}/${h.stars}★`).join(", ");
            lines.push(`- ${q.squad}: ${q.might}${heroes ? ` · ${heroes}` : ""}`);
        }
    }
    if (p.scores.length) {
        lines.push("", `**AD scores** (minimum ${p.min.toLocaleString("en-US")} a day; ⚠ = below)`);
        for (const s of p.scores.slice(0, WEEKS)) {
            const days = s.days
                .map((d, i) => `${DAY_LABELS[i] ?? i + 1} ${d === "" ? "-" : d}${d === "" || num(d) < p.min ? " ⚠" : ""}`)
                .join(" · ");
            lines.push(`- Week of ${s.week}: ${days} · weekly ${s.weekly || "-"} ${s.target ? "✅" : "❌"}`);
        }
    }
    if (p.donations.length) {
        lines.push("", `**Donations** (minimum ${p.minDonation}${p.donationCheck ? "" : ", check off"})`);
        for (const d of p.donations.slice(0, WEEKS))
            lines.push(`- Week of ${d.week}: ${d.amount} ${d.target ? "✅" : "❌"}`);
    }
    if (p.log.length) {
        lines.push("", "**Recent rotation**");
        for (const l of p.log.slice(0, 5)) {
            lines.push(`- ${l.date}: ${l.role}, ${l.result}${l.special ? " (special nomination)" : ""}${l.reason ? ` · ${l.reason}` : ""}`);
        }
    }
    return lines.join("\n");
}
/** The answer to /player: the best match in full, the other matches by name. */
export function searchAnswer(players, query, forOfficer) {
    const [first, ...rest] = players;
    if (!first)
        return `No player found for **${query}**.`;
    const others = rest.length ? `\n\nAlso found: ${rest.map((p) => p.name).join(", ")}` : "";
    return playerCard(first, forOfficer) + others;
}
//# sourceMappingURL=player-card.js.map