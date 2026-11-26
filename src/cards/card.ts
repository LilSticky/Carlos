import type { APIEmbed, APIEmbedField } from "discord.js";
import { z } from "zod";
import { cut, percent, short, table } from "./format.js";

/**
 * The player card: what anyone may know about a player's combat strength. It comes from Alliance Statistics
 * (stats/BotActions.js, action "card"), which leaves out every value it does not know; so does the card. Member
 * KPIs (AD scores, donations, duties) are not part of it: officers see them with /stats.
 */
const num = z.number().optional().catch(undefined);
const str = z.coerce.string().optional().catch(undefined);

const hero = z.object({ hero: z.string(), level: num, stars: num, gear: str, gearQuality: str, skills: str, faction: str });
const squad = z.object({
  n: z.number().catch(0),
  seen: str,
  result: str,
  power: num,
  lineup: num,
  raven: num,
  tech: num,
  curio: num,
  soldier: num,
  hallOfHonor: num,
  gearPower: num,
  skillPower: num,
  lineupBonus: num,
  ravenLevel: num,
  ravenStars: num,
  ravenSkillLevel: num,
  ravenSkillStars: num,
  epigraphs: str,
  factionBonus: str,
  faction: str,
  factionSame: num,
  factionMix: str,
  factionKnown: z.boolean().optional().catch(undefined),
  factionPercent: num,
  troopTier: str,
  heroes: z.array(hero).catch([]),
});
const screenshotSquad = z.object({
  squad: z.coerce.string(),
  might: num,
  heroes: z.array(z.object({ hero: z.string(), level: num, stars: num })).catch([]),
});

/** A row of the vault's Squad Roster (Rosters.js of Alliance Members): one lineup kept for one kind of fight. */
const rosterRow = z.object({
  group: z.string(),
  setup: z.string(),
  heroes: str,
  factions: str,
  bonus: str,
  power: num,
  powerFrom: str,
  losses: num,
  damage: num,
  seen: str,
  note: str,
});
export type CardRosterRow = z.infer<typeof rosterRow>;

const player = z.object({
  name: z.string(),
  member: z.boolean().catch(false),
  kingdom: str,
  alliance: str,
  rank: str,
  tracker: z
    .object({ might: num, mightChange30: num, level: num, kills30: num, battleKills: num, battleMightLost: num, mightPlace: num, of: num })
    .optional()
    .catch(undefined),
  readiness: z
    .object({ score: num, bledOut: z.boolean().catch(false), mightPeak: num, lastBattle: str, lost: num, regained: z.coerce.number().optional().catch(undefined), why: str, updated: str })
    .optional()
    .catch(undefined),
  screenshot: z
    .object({ top3: num, checked: str, date: str, total: num, squads: z.array(screenshotSquad).catch([]) })
    .optional()
    .catch(undefined),
  intel: z
    .object({
      reports: num,
      lastSeen: str,
      location: str,
      bestPower: num,
      top3: num,
      top3Check: str,
      lineup: num,
      raven: num,
      tech: num,
      curio: num,
      soldier: num,
      hallOfHonor: num,
      playerLevel: num,
      ravenLevel: str,
      epigraphs: str,
      faction: str,
      squads: z.array(squad).catch([]),
      arena: z.object({ rank: num, points: num, tier: str, seen: str }).optional().catch(undefined),
      roster: z.array(rosterRow).catch([]),
    })
    .optional()
    .catch(undefined),
});
export type CardPlayer = z.infer<typeof player>;

const match = z.object({ name: z.string(), kingdom: str, alliance: str, member: z.boolean().catch(false) });
export type CardMatch = z.infer<typeof match>;

const answer = z.object({ matches: z.array(match).catch([]), player: player.nullable().catch(null) });
export type CardAnswer = z.infer<typeof answer>;

export function readCard(raw: unknown): CardAnswer | undefined {
  const parsed = answer.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** Embed colours: our alliance, another alliance, and a warning for a bled-out member. */
export const COLORS = { ours: 0x2e7d32, theirs: 0xb71c1c, bledOut: 0xef8f00, officer: 0x5e35b1 } as const;

export function sideLabel(p: { kingdom?: string | undefined; alliance?: string | undefined }): string {
  return [p.alliance ? `[${p.alliance}]` : "no alliance", p.kingdom ? `Kingdom #${p.kingdom}` : ""].filter(Boolean).join(" · ");
}

const field = (name: string, value: string | undefined, inline = true): APIEmbedField[] =>
  value ? [{ name, value: cut(value, 1024), inline }] : [];
const val = (n: number | undefined, f: (n: number) => string = short) => (n === undefined ? undefined : f(n));

/** "Lv.125 5★ · skill Lv.125 4★" from a squad sighting. */
function ravenText(s: z.infer<typeof squad> | undefined, fallback: string | undefined): string | undefined {
  if (!s || s.ravenLevel === undefined) return fallback?.replace(/(\d)\*/g, "$1★");
  const skill = s.ravenSkillLevel !== undefined ? ` · skill Lv.${s.ravenSkillLevel}${s.ravenSkillStars !== undefined ? ` ${s.ravenSkillStars}★` : ""}` : "";
  return `Lv.${s.ravenLevel}${s.ravenStars !== undefined ? ` ${s.ravenStars}★` : ""}${skill}`;
}

/** "orange 3/orange 3/purple 4/orange 3" -> "3× orange 3, purple 4". */
export function epigraphText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const counts = new Map<string, number>();
  for (const e of text.split("/").map((s) => s.trim()).filter(Boolean)) counts.set(e, (counts.get(e) ?? 0) + 1);
  return [...counts].map(([e, n]) => (n > 1 ? `${n}× ${e}` : e)).join(", ");
}

/** "60/30/40/40" with "red/orange/..." -> "60+ 30 40 40": red gear marked with +. */
export function gearText(gear: string | undefined, quality: string | undefined): string {
  if (!gear) return "-";
  const q = (quality ?? "").split("/");
  return gear
    .split("/")
    .map((g, i) => `${g}${/red/i.test(q[i] ?? "") ? "+" : ""}`)
    .join(" ");
}

function profileEmbed(p: CardPlayer, matches: readonly CardMatch[]): APIEmbed {
  const t = p.tracker, r = p.readiness, i = p.intel;
  const latest = i?.squads.reduce<z.infer<typeof squad> | undefined>((a, s) => (!a || (s.seen ?? "") > (a.seen ?? "") ? s : a), undefined);
  const level = t?.level ?? i?.playerLevel;
  const head = [p.member && p.rank ? p.rank : "", level !== undefined ? `Level ${level}` : "", i?.faction ?? ""].filter(Boolean).join(" · ");
  const fields: APIEmbedField[] = [
    ...field("Might", val(t?.might)),
    ...field("Place in the alliance", t?.mightPlace ? `#${t.mightPlace} of ${t.of ?? "?"}` : undefined),
    ...field("Might, 30 days", val(t?.mightChange30, (n) => percent(n))),
    ...field("Kills, 30 days", val(t?.kills30)),
    ...field("Kills in battle", val(t?.battleKills)),
    ...field("Might lost in battle", val(t?.battleMightLost)),
  ];
  if (r?.score !== undefined) {
    const regained = r.lost && r.regained !== undefined ? `, ${percent(r.regained / r.lost, false)} back` : "";
    fields.push(
      ...field("Combat readiness", `**${r.score}**/100${r.bledOut ? " · bled out" : ""}`),
      ...field("Might peak since the battle", val(r.mightPeak)),
      ...field("Last battle", r.lastBattle ? `${r.lastBattle}${r.lost ? `: lost ${short(r.lost)}${regained}` : ""}` : undefined),
    );
  }
  if (i) {
    fields.push(
      ...field("Best battle power", val(i.bestPower)),
      ...field("Top 3 squads", i.top3 !== undefined ? short(i.top3) : p.screenshot?.top3 !== undefined ? short(p.screenshot.top3) : undefined),
      ...field("Lineup power", val(i.lineup)),
      ...field("Raven", ravenText(latest, i.ravenLevel)),
      ...field("Tech", val(i.tech)),
      ...field("Curio", val(i.curio)),
      ...field("Soldier", val(i.soldier)),
      ...field("Hall of Honor", val(i.hallOfHonor)),
      ...field("Epigraphs", epigraphText(i.epigraphs)),
    );
    if (i.arena?.rank) {
      fields.push(...field("Arena", `#${i.arena.rank}${i.arena.points ? ` · ${short(i.arena.points)} points` : ""}${i.arena.tier ? ` · ${i.arena.tier}` : ""}`));
    }
    if (!p.member) fields.push(...field("Last seen at", i.location));
  } else if (p.screenshot?.top3 !== undefined) {
    fields.push(...field("Top 3 squads", short(p.screenshot.top3)));
  }
  if (r?.why) fields.push(...field("Readiness, in short", r.why, false));
  const others = matches.filter((m) => m.name !== p.name).slice(0, 8);
  if (others.length) fields.push(...field("Also found", others.map((m) => `${m.name} (${sideLabel(m)})`).join(", "), false));

  const sources = [
    t || r ? `Tracker ${r?.updated ?? ""}`.trim() : "",
    i?.reports ? `${i.reports} report${i.reports === 1 ? "" : "s"}, last ${i.lastSeen ?? "?"} server time` : "",
    p.screenshot?.date ? `squad screenshot ${p.screenshot.date}` : "",
  ].filter(Boolean);
  const known = fields.length > 0;
  return {
    color: p.member ? (r?.bledOut ? COLORS.bledOut : COLORS.ours) : COLORS.theirs,
    author: { name: sideLabel(p) },
    title: p.name,
    description: [head, known ? "" : "Nothing known yet: no tracker values, squad screenshots or reports."].filter(Boolean).join("\n") || undefined,
    fields: fields.slice(0, 25),
    footer: sources.length ? { text: sources.join(" · ") } : undefined,
  } as APIEmbed;
}

/**
 * The faction bonus of a squad, worked out from its heroes' factions by the sheet (3 of one faction 10%, 4 15%,
 * 5 20%), with the Might it adds when a report showed it: "20% · 5 Warlock · +2.1M Might". With a hero's faction
 * unknown the bonus may be higher. Without heroes: the percentage the report wrote, if any.
 */
export function factionBonusText(s: z.infer<typeof squad>): string | undefined {
  const might = s.lineupBonus ? ` · +${short(s.lineupBonus)} Might` : "";
  if (s.factionPercent === undefined || !s.factionMix) return s.factionBonus ? `${s.factionBonus}${might}` : undefined;
  const pct = `${s.factionPercent}%${s.factionKnown === false && (s.factionSame ?? 0) < 5 ? " or more" : ""}`;
  return `${pct} · ${s.factionMix}${might}`;
}

/** One squad seen in a report: its strength and the heroes' level, stars, gear and skills. */
function squadEmbed(p: CardPlayer, s: z.infer<typeof squad>): APIEmbed {
  const rows = s.heroes.map((h) => [
    cut(h.hero, 10),
    h.level !== undefined ? String(h.level) : "-",
    h.stars !== undefined ? String(h.stars) : "-",
    gearText(h.gear, h.gearQuality),
    (h.skills ?? "-").split("/").join(" "),
  ]);
  const fields = [
    ...field("Faction bonus", factionBonusText(s), false),
    ...field("Lineup", val(s.lineup)),
    ...field("Raven", val(s.raven)),
    ...field("Tech", val(s.tech)),
    ...field("Curio", val(s.curio)),
    ...field("Soldier", val(s.soldier)),
    ...field("Hall of Honor", val(s.hallOfHonor)),
    ...field("Gear", val(s.gearPower)),
    ...field("Skills", val(s.skillPower)),
    ...field("Troop tier", s.troopTier),
  ];
  return {
    color: p.member ? COLORS.ours : COLORS.theirs,
    title: `${s.n ? `Squad ${s.n}` : "Squad (number not shown)"}${s.power !== undefined ? ` · ${short(s.power)} battle power` : ""}`,
    description: rows.length
      ? `${table(["Hero", "Lv", "★", "Gear", "Skills"], rows, ["l", "r", "r", "l", "l"])}\n-# Gear and skill levels per slot; + = red gear`
      : undefined,
    fields: fields.slice(0, 25),
    footer: { text: [s.seen ? `Seen ${s.seen}` : "", s.result ?? ""].filter(Boolean).join(" · ") || "Battle report" },
  } as APIEmbed;
}

/** The member's own squad screenshot: each squad's Might and heroes. */
function screenshotEmbed(p: CardPlayer): APIEmbed | undefined {
  const s = p.screenshot;
  if (!s?.squads.length) return undefined;
  const lines = s.squads.map((q) => {
    const heroes = q.heroes.map((h) => `${h.hero} ${h.level ?? "?"}/${h.stars ?? "?"}★`).join(", ");
    return `**${q.squad}** · ${short(q.might)}\n${heroes || "-"}`;
  });
  return {
    color: COLORS.ours,
    title: `Squads from the screenshot${s.total !== undefined ? ` · ${short(s.total)} in all` : ""}`,
    description: cut(lines.join("\n"), 4096),
    footer: { text: `Screenshot of ${s.date ?? "?"} · hero level/stars` },
  };
}

/** What a setup is ranked by: damage, soldiers lost, or power ("-" when no report showed it). */
function rosterValue(r: CardRosterRow): string {
  if (/bait|fewest/i.test(r.setup)) return r.losses !== undefined ? `${r.losses.toLocaleString("en-US")} lost` : "-";
  if (r.group === "Demon King" || /damage/i.test(r.setup)) return r.damage !== undefined ? `${short(r.damage)} damage` : "-";
  if (r.power === undefined) return "-";
  return /might/i.test(r.powerFrom ?? "") ? `${short(r.power)} Might` : short(r.power);
}

/**
 * The squad setups of the player (Squad Roster of the vault): one field per kind of fight, one line per
 * lineup. A player has four squad slots but fields other lineups against players, bosses and events.
 */
export function rosterEmbed(p: CardPlayer): APIEmbed | undefined {
  const rows = p.intel?.roster ?? [];
  if (!rows.length) return undefined;
  const fields: APIEmbedField[] = [];
  for (const r of rows) {
    const heroes = r.heroes ? r.heroes.replace(/(\d)\*/g, "$1★") : "heroes not seen";
    const tail = [r.bonus ? `${r.bonus} bonus` : "", r.seen ?? ""].filter(Boolean).join(" · ");
    const line = `${r.setup}: **${rosterValue(r)}** ${heroes}${tail ? ` · ${tail}` : ""}`;
    const last = fields[fields.length - 1];
    const sameGroup = last?.name.replace(/ \(more\)$/, "") === r.group;
    if (last && sameGroup && last.value.length + line.length < 1000) last.value += `\n${line}`;
    else if (fields.length < 25) fields.push({ name: sameGroup ? `${r.group} (more)` : r.group, value: cut(line, 1024), inline: false });
  }
  return {
    color: p.member ? COLORS.ours : COLORS.theirs,
    title: "Squad setups",
    description: "The lineups kept per kind of fight. PvP calculated: never seen together, built from the heroes known.",
    fields,
  };
}

/** All embeds of a card, within Discord's limits (10 embeds, 6000 characters in one message). */
export function cardEmbeds(answer: CardAnswer): APIEmbed[] {
  const p = answer.player;
  if (!p) return [];
  const list = [profileEmbed(p, answer.matches)];
  const roster = rosterEmbed(p);
  if (roster) list.push(roster);
  const shot = screenshotEmbed(p);
  if (shot) list.push(shot);
  for (const s of p.intel?.squads.slice(0, 4) ?? []) list.push(squadEmbed(p, s));
  const out: APIEmbed[] = [];
  let size = 0;
  for (const e of list) {
    const n = JSON.stringify(e).length;
    if (out.length && size + n > 5800) break;
    out.push(e);
    size += n;
  }
  return out;
}
