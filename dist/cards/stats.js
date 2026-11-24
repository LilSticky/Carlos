import { z } from "zod";
import { COLORS } from "./card.js";
import { cut, dayMonth, percent, short, table } from "./format.js";
/**
 * /stats: the full numbers of one member, for R4 and R5 only. From Alliance Statistics (stats/BotActions.js,
 * action "stats"). Everything is a table, as the officers asked.
 */
const num = z.number().nullable().optional().catch(undefined);
const week = z.object({
    week: z.string(),
    days: z.array(num).optional().catch(undefined),
    weekly: num,
    donation: num,
    tech: num,
    honor: num,
    activity: num,
});
const duty = z.object({ day: z.string().catch(""), role: z.string().catch(""), result: z.string().catch(""), reason: z.string().optional().catch(undefined), special: z.boolean().catch(false) });
const answer = z.object({
    name: z.string(),
    rank: z.string().optional().catch(undefined),
    joined: z.string().optional().catch(undefined),
    notes: z.string().optional().catch(undefined),
    minScore: num,
    minDonation: num,
    kpis: z.array(z.tuple([z.string(), z.union([z.number(), z.string(), z.boolean()])])).catch([]),
    weeks: z.array(week).catch([]),
    duties: z.array(duty).catch([]),
});
export function readStats(raw) {
    const parsed = answer.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
}
const PERCENT = new Set(["AD participation", "KvK turnout"]);
const GROWTH = new Set(["AD growth", "Might 30 days"]);
const SKIP = new Set(["Rank", "Joined"]); // in the title already
function kpiValue(name, v) {
    if (typeof v === "boolean")
        return v ? "yes" : "no";
    if (typeof v === "string")
        return v;
    if (PERCENT.has(name))
        return percent(v, false);
    if (GROWTH.has(name))
        return percent(v);
    if (name === "Nomination score")
        return v.toFixed(1);
    return short(v);
}
const DAYS = ["I", "II", "III", "IV", "V", "VI"];
const millions = (n) => (n === null || n === undefined ? "-" : (n / 1e6).toFixed(1));
export function statsEmbeds(s) {
    const min = s.minScore ?? 0;
    const embeds = [];
    const kpis = s.kpis.filter(([k]) => !SKIP.has(k)).map(([k, v]) => [k, kpiValue(k, v)]);
    embeds.push({
        color: COLORS.officer,
        author: { name: "Officers only · full statistics" },
        title: s.name,
        description: [
            [s.rank, s.joined ? `joined ${s.joined}` : ""].filter(Boolean).join(" · "),
            kpis.length ? table(["Statistic", "Value"], kpis, ["l", "r"]) : "No statistics yet: Alliance Statistics has not rated this member.",
        ].filter(Boolean).join("\n"),
        fields: s.notes ? [{ name: "Notes", value: cut(s.notes, 1024) }] : [],
    });
    const scored = s.weeks.filter((w) => w.days?.some((d) => d !== null && d !== undefined));
    if (scored.length) {
        const rows = scored.map((w) => [
            dayMonth(w.week),
            ...DAYS.map((_, i) => {
                const d = w.days?.[i];
                return d === null || d === undefined ? "- " : `${millions(d)}${d < min ? "*" : " "}`;
            }),
            millions(w.weekly),
        ]);
        embeds.push({
            color: COLORS.officer,
            title: "Alliance Duel, in millions",
            description: `${table(["Week", ...DAYS.map((d) => `${d} `), "Total"], rows, ["l", "r", "r", "r", "r", "r", "r", "r"])}\n-# * = below the daily minimum of ${short(min)}`,
        });
    }
    if (s.weeks.length) {
        const rows = s.weeks.map((w) => [
            dayMonth(w.week),
            w.weekly != null ? short(w.weekly) : "-",
            w.donation != null ? `${short(w.donation)}${s.minDonation && w.donation < s.minDonation ? "*" : " "}` : "- ",
            w.tech != null ? short(w.tech) : "-",
            w.honor != null ? short(w.honor) : "-",
            w.activity != null ? short(w.activity) : "-",
        ]);
        embeds.push({
            color: COLORS.officer,
            title: "Week by week",
            description: `${table(["Week", "AD", "Donat. ", "Tech", "Honor", "Activ."], rows, ["l", "r", "r", "r", "r", "r"])}${s.minDonation ? `\n-# * = below the weekly donation of ${short(s.minDonation)}; tech, honor and activity from the tracker` : ""}`,
        });
    }
    if (s.duties.length) {
        const rows = s.duties.map((d) => [dayMonth(d.day), d.role + (d.special ? " (MVP)" : ""), cut(d.result, 10), cut(d.reason ?? "", 14)]);
        embeds.push({
            color: COLORS.officer,
            title: "Coachman Express duties",
            description: table(["Day", "Role", "Result", "Why"], rows, ["l", "l", "l", "l"]),
        });
    }
    return embeds;
}
//# sourceMappingURL=stats.js.map