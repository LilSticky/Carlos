import type { APIEmbed, APIEmbedField } from "discord.js";
import { z } from "zod";
import { short } from "../farms/farms.js";

/**
 * Player and alliance lookups on the Last Asylum Tracker, asked through Alliance Members (members/Lookup.js), which
 * holds the tracker key: `trackerPlayer` by uid or by complete name (optionally in one Kingdom), `trackerAlliance`
 * by tag or full name in one Kingdom. The tracker only knows what its map showed at the last Update Map, so every
 * card says when the map was read. Carlos only formats what the sheet answers.
 */

const num = z.number().nullable();
const text = z.string().nullable().optional();
const quota = z.object({ remaining: num, limit: num }).nullable().optional();

const member = z.object({
  uid: z.string(),
  name: z.string(),
  rank: z.string(),
  might: num,
  level: num,
  online: z.boolean().optional(),
  lastOnline: text,
});
export type RosterMember = z.infer<typeof member>;

const player = z.object({
  uid: z.string(),
  name: z.string(),
  kingdom: z.string(),
  might: num,
  level: num,
  kills: num,
  vip: num,
  likes: num,
  language: z.string(),
  x: num,
  y: num,
  alliance: z.object({ tag: z.string(), name: z.string(), members: num }).nullable(),
  rank: z.string(),
  picture: text,
  mapUpdated: text,
  lastSeen: text,
  quota,
});
export type TrackerPlayer = z.infer<typeof player>;

const match = z.object({ uid: z.string(), kingdom: z.string(), name: z.string() });
export type PlayerMatch = z.infer<typeof match>;

const alliance = z.object({
  id: z.string(),
  tag: z.string(),
  name: z.string(),
  kingdom: z.string(),
  might: num,
  level: num,
  members: num,
  capacity: num,
  leader: z.string(),
  mightRank: num,
  picture: text,
  roster: z.array(member),
  quota,
});
export type TrackerAlliance = z.infer<typeof alliance>;

const playerAnswer = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("found"), player }),
  z.object({ kind: z.literal("ambiguous"), matches: z.array(match) }),
  z.object({ kind: z.literal("not-found") }),
]);
export type PlayerAnswer = z.infer<typeof playerAnswer>;

const allianceAnswer = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("found"), alliance }),
  z.object({ kind: z.literal("not-found"), kingdom: z.string() }),
]);
export type AllianceAnswer = z.infer<typeof allianceAnswer>;

/** The answer of `trackerPlayer`, or undefined when Carlos cannot read it. */
export function readPlayerAnswer(raw: unknown): PlayerAnswer | undefined {
  const parsed = playerAnswer.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** The answer of `trackerAlliance`, or undefined when Carlos cannot read it. */
export function readAllianceAnswer(raw: unknown): AllianceAnswer | undefined {
  const parsed = allianceAnswer.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** What /whois asks: a uid, or a complete name, optionally in one Kingdom. */
export interface PlayerQuery {
  readonly uid?: string | undefined;
  readonly name?: string | undefined;
  readonly kingdom?: number | undefined;
}

/** The arguments for `trackerPlayer`: the uid wins over a name. Undefined when neither is usable. */
export function playerArgs(q: PlayerQuery): Record<string, string> | undefined {
  const uid = (q.uid ?? "").replace(/\D/g, "");
  if (uid) return { uid };
  const name = (q.name ?? "").trim();
  if (!name) return undefined;
  return q.kingdom ? { name, kingdom: String(q.kingdom) } : { name };
}

/** Discord's own markdown in a name shows as typed. */
export function plain(s: string): string {
  return s.replace(/([\\*_~`|>[\]()])/g, "\\$1");
}

const LANGUAGES: Readonly<Record<string, string>> = {
  en: "English", de: "German", fr: "French", es: "Spanish", pt: "Portuguese", it: "Italian", ru: "Russian",
  tr: "Turkish", pl: "Polish", nl: "Dutch", ar: "Arabic", ja: "Japanese", ko: "Korean", zh: "Chinese",
  "zh-cn": "Chinese", "zh-tw": "Chinese", th: "Thai", vi: "Vietnamese", id: "Indonesian", uk: "Ukrainian",
};

function language(code: string): string | undefined {
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  return LANGUAGES[c] ?? LANGUAGES[c.split(/[-_]/)[0] ?? ""] ?? code;
}

const field = (name: string, value: string | undefined, inline = true): APIEmbedField[] =>
  value === undefined || value === "" ? [] : [{ name, value, inline }];
const n = (v: number | null): string | undefined => (v === null ? undefined : v.toLocaleString("en-US"));

/** "Map read 2026-11-24 18:00 server time · 812 tracker requests left today". */
function footer(mapUpdated: string | null | undefined, q: z.infer<typeof quota>): { text: string } {
  const parts = [
    "Last Asylum Tracker",
    mapUpdated ? `map read ${mapUpdated} server time` : "",
    q?.remaining !== null && q?.remaining !== undefined ? `${q.remaining} requests left today` : "",
  ];
  return { text: parts.filter(Boolean).join(" · ") };
}

/** Tracker cards are neither ours nor theirs: one colour of their own. */
export const TRACKER_COLOR = 0x1565c0;

/** The player card: Might, level, kills, alliance and rank, where they sit. */
export function playerEmbed(p: TrackerPlayer): APIEmbed {
  const a = p.alliance;
  const fields: APIEmbedField[] = [
    ...field("Might", n(p.might)),
    ...field("Sanctuary level", n(p.level)),
    ...field("Kills", n(p.kills)),
    ...field("VIP", n(p.vip)),
    ...field("Likes", n(p.likes)),
    ...field("Language", language(p.language)),
    ...field("Alliance", a ? `[${plain(a.tag)}] ${plain(a.name)}`.trim() : "No alliance"),
    ...field("Alliance Rank", a ? p.rank || "Unknown" : undefined),
    ...field("Location", p.x !== null && p.y !== null ? `X:${p.x} Y:${p.y}` : undefined),
    ...field("uid", p.uid || undefined),
  ];
  return {
    color: TRACKER_COLOR,
    author: { name: p.kingdom ? `Kingdom #${p.kingdom}` : "Kingdom unknown" },
    title: plain(p.name).slice(0, 256),
    ...(p.picture ? { thumbnail: { url: p.picture } } : {}),
    fields,
    footer: footer(p.mapUpdated, p.quota),
  };
}

/** The roster as lines by rank, as many as fit in `budget` characters; the rest only counted. */
export function rosterText(roster: readonly RosterMember[], budget = 3500): string {
  const lines: string[] = [];
  let used = 0;
  let rank: string | undefined;
  for (const [i, m] of roster.entries()) {
    const head = m.rank !== rank ? `${lines.length ? "\n" : ""}**${m.rank || "Rank unknown"}**\n` : "";
    const line = `${head}${plain(m.name)}${m.might !== null ? ` · ${short(m.might)}` : ""}`;
    if (used + line.length + 40 > budget) {
      lines.push(`…and ${roster.length - i} more.`);
      break;
    }
    lines.push(line);
    used += line.length + 1;
    rank = m.rank;
  }
  return lines.join("\n");
}

/** The alliance card: Might, level, members, leader and the roster by rank. */
export function allianceEmbed(a: TrackerAlliance): APIEmbed {
  const fields: APIEmbedField[] = [
    ...field("Might", n(a.might)),
    ...field("Might rank in the Kingdom", a.mightRank !== null ? `#${a.mightRank}` : undefined),
    ...field("Level", n(a.level)),
    ...field("Members", a.members !== null ? `${a.members}${a.capacity !== null ? `/${a.capacity}` : ""}` : undefined),
    ...field("Leader", a.leader ? plain(a.leader) : undefined),
  ];
  return {
    color: TRACKER_COLOR,
    author: { name: a.kingdom ? `Kingdom #${a.kingdom}` : "Kingdom unknown" },
    title: `[${plain(a.tag)}] ${plain(a.name)}`.trim().slice(0, 256),
    ...(a.picture ? { thumbnail: { url: a.picture } } : {}),
    description: a.roster.length ? rosterText(a.roster) : "The tracker shows no members.",
    fields,
    footer: footer(undefined, a.quota),
  };
}

/** Discord allows 25 options in a select menu. */
const MENU_MAX = 25;

/** The menu under an alliance card: its members, to look one up. Values are uids. */
export function rosterOptions(a: TrackerAlliance): { label: string; value: string; description: string }[] {
  return a.roster
    .filter((m) => m.uid)
    .slice(0, MENU_MAX)
    .map((m) => ({
      label: m.name.slice(0, 100) || m.uid,
      value: m.uid,
      description: [m.rank, m.might !== null ? `Might ${short(m.might)}` : ""].filter(Boolean).join(" · ").slice(0, 100) || "Member",
    }));
}

/** The menu when several players share a name: one option per player. Values are uids. */
export function matchOptions(matches: readonly PlayerMatch[]): { label: string; value: string; description: string }[] {
  return matches.slice(0, MENU_MAX).map((m) => ({
    label: m.name.slice(0, 100) || m.uid,
    value: m.uid,
    description: `${m.kingdom ? `Kingdom #${m.kingdom} · ` : ""}uid ${m.uid}`.slice(0, 100),
  }));
}

/** The text when several players share a name. */
export function ambiguousText(name: string, matches: readonly PlayerMatch[]): string {
  const more = matches.length > MENU_MAX ? ` The menu shows the first ${MENU_MAX}; add the Kingdom to narrow it down.` : "";
  return `${matches.length} players are called **${plain(name)}**. Pick the one you mean.${more}`;
}

/** The text when the tracker knows no such player. */
export function playerNotFoundText(args: Record<string, string>): string {
  if (args.uid) return `The tracker knows no player with uid **${args.uid}**.`;
  const where = args.kingdom ? ` in Kingdom #${args.kingdom}` : "";
  return (
    `The tracker knows no player called **${plain(args.name ?? "")}**${where}. Type the complete name as in the game ` +
    "(the tracker has no partial match), or use the uid from the profile. Members of ours and players seen in reports: **/player**."
  );
}

/** The text when the tracker knows no such alliance. */
export function allianceNotFoundText(search: string, kingdom: string): string {
  return (
    `The tracker knows no alliance **${plain(search)}** in Kingdom #${kingdom}. Use the tag (like ABC) or the complete ` +
    "name, and add the Kingdom when it is not ours."
  );
}
