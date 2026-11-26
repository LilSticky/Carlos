import type { APIEmbed, APIEmbedField } from "discord.js";
import { z } from "zod";
import { cut, dayMonth, short } from "../cards/format.js";
import { dayList } from "./days.js";

/**
 * The intel scoreboards of Alliance Members (members/Scores.js, Bot.js action `scores`): points for the reports
 * members post, on the Battle Scoreboard (for the sender) and the Scouting Scoreboard (for the scout), plus the Intel
 * Quests that run today. The sheet does the scoring; Carlos only lays the boards out.
 */
const text = z.string().catch("");
const num = z.number().catch(0);
const row = z.object({
  rank: num,
  member: z.string().min(1),
  points: num,
  last7Days: num,
  base: num,
  quests: num,
  reports: num,
  /** The report that earned most: "Luzia1 (110)". */
  best: text,
  /** When the member last earned points, server time ("2026-11-25 16:50"). */
  last: text,
});
const battleRow = row.extend({ newFinds: num });
const scoutRow = row.extend({ resources: num });
const quest = z.object({
  quest: text,
  board: text,
  from: text,
  until: text,
  /** The days of the AD week it runs on, as the officers wrote them ("IV, Rest Day"); "" = every day. */
  days: text,
  /** The report type it asks for ("Barracks"). */
  type: text,
  note: text,
  /** Today is one of its days (server time). */
  runsToday: z.boolean().catch(true),
  multiplier: z.number().nullable().catch(null),
  bonus: z.number().nullable().catch(null),
  reports: num,
  points: num,
  leader: text,
});
const scores = z.object({
  battle: z.array(battleRow),
  scouting: z.array(scoutRow),
  since: text,
  /** The server date the sheet answered on. */
  today: text,
  quests: z.array(quest).catch([]),
});
export type Scores = z.infer<typeof scores>;
type Row = z.infer<typeof row>;

/** The answer of `scores`, or undefined when Carlos cannot read it. */
export function readScores(raw: unknown): Scores | undefined {
  const parsed = scores.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export const BATTLE_COLOR = 0x1565c0;
export const SCOUT_COLOR = 0xef8f00;
export const QUEST_COLOR = 0x5e35b1;
/** Rows per board: three on the podium, the rest as a list. */
export const BOARD_ROWS = 15;
const PLACES = ["1st place", "2nd place", "3rd place"];

/** 4219.5 -> "4,219.5". */
export function points(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** "+120 in the last 7 days", only when older points exist too. */
function recent(r: Row): string {
  return r.last7Days > 0 && r.last7Days < r.points ? ` · +${points(r.last7Days)} this week` : "";
}

function podium(rows: readonly Row[], detail: (r: Row) => string): APIEmbedField[] {
  return rows.slice(0, 3).map((r, i) => ({
    name: PLACES[i]!,
    value: cut(`**${r.member}**\n${points(r.points)} pts\n${detail(r)}`, 1024),
    inline: true,
  }));
}

function rest(rows: readonly Row[], detail: (r: Row) => string): APIEmbedField[] {
  const lines = rows.slice(3, BOARD_ROWS).map((r) => `\`${String(r.rank).padStart(2)}\` **${r.member}** · ${points(r.points)} pts · ${detail(r)}${recent(r)}`);
  if (rows.length > BOARD_ROWS) lines.push(`…and ${rows.length - BOARD_ROWS} more on the scoreboard tab.`);
  return lines.length ? [{ name: "The chase", value: cut(lines.join("\n"), 1024) }] : [];
}

function board(
  title: string,
  color: number,
  intro: string,
  rows: readonly Row[],
  detail: (r: Row) => string,
  empty: string,
): APIEmbed {
  if (!rows.length) return { title, color, description: `${intro}\n\n*${empty}*` };
  return { title, color, description: intro, fields: [...podium(rows, detail), ...rest(rows, detail)] };
}

function questLine(q: Scores["quests"][number]): APIEmbedField {
  const reward = q.multiplier && q.multiplier !== 1 ? `points x${points(q.multiplier)}` : q.bonus ? `+${points(q.bonus)} per new report` : "";
  const repeat = q.days ? dayList(q.days) : "";
  const when = [repeat ? `every ${repeat}` : "", q.until ? `until ${dayMonth(q.until)}` : repeat ? "" : "open end"].filter(Boolean).join(", ");
  const head = [q.board ? `${q.board} board` : "", reward, when].filter(Boolean).join(" · ");
  const score = q.reports
    ? `${plural(q.reports, "report")} so far, ${points(q.points)} pts${q.leader ? ` · leading: **${q.leader}**` : ""}`
    : "No report yet: be the first.";
  return { name: cut(q.quest || "Intel Quest", 256), value: cut(`${head}\n${score}`, 1024) };
}

/**
 * The forum post: the Battle and the Scouting Scoreboard, then the running Intel Quests. `uploadChannelId` is where
 * members post their screenshots. Leaves out the moment, so the post changes only when the points do.
 */
export function scoreEmbeds(s: Scores, uploadChannelId: string): APIEmbed[] {
  const upload = `<#${uploadChannelId}>`;
  const counted = s.since ? ` Counted from ${dayMonth(s.since)}.` : "";
  const embeds: APIEmbed[] = [
    board(
      "Battle Scoreboard",
      BATTLE_COLOR,
      `Points for every battle report, hero page or other report you post in ${upload}. New intel earns most, ` +
        `intel the alliance already knows earns nothing.${counted}`,
      s.battle,
      (r) => {
        const b = r as Row & { newFinds: number };
        return `${plural(b.reports, "report")} · ${plural(b.newFinds, "new find")}`;
      },
      `No points yet. Post a battle report in ${upload} and take first place.`,
    ),
    board(
      "Scouting Scoreboard",
      SCOUT_COLOR,
      `Points for scout reports, by the grain, timber and herb they show: a rich farm earns more. ` +
        `The same Sanctuary scouted again soon earns little.${counted}`,
      s.scouting,
      (r) => {
        const sc = r as Row & { resources: number };
        return `${plural(sc.reports, "scout")} · ${short(sc.resources)} found`;
      },
      `No points yet. Scout a player without an alliance tag and post the report in ${upload}.`,
    ),
  ];
  if (s.quests.length) {
    embeds.push({
      title: "Intel Quests",
      color: QUEST_COLOR,
      description: "The officers want these reports now. Reports that fit earn extra points.",
      fields: s.quests.slice(0, 10).map(questLine),
    });
  }
  return embeds;
}

/** The same embeds with the footer and the moment of the last change on the last one. */
export function stampEmbeds(embeds: readonly APIEmbed[], changedAt: Date): APIEmbed[] {
  return embeds.map((e, i) =>
    i === embeds.length - 1
      ? { ...e, footer: { text: "Carlos updates this post when the points change. Last change" }, timestamp: changedAt.toISOString() }
      : e,
  );
}
