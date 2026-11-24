import { z } from "zod";

/**
 * Farms: players without an alliance tag whose scout reports showed a lot of grain, timber and herb. Alliance
 * Members keeps the list (Farms tab, BotActions.js): `farms` lists them, `hit` puts one on cooldown (its Sanctuary
 * needs time to recover, or the player relocates), `retrace` asks the tracker where a farm went. Carlos only
 * formats what the sheet answers.
 */
export interface Farm {
  /** The sheet's key for the farm ("330|luzia1"). */
  readonly key: string;
  readonly player: string;
  readonly kingdom: string;
  /** Where the farm is, as far as known ("X:749 Y:920"). */
  readonly location: string;
  /** Where that comes from: "scout 2026-11-19 19:03" or "tracker 2026-11-24 18:00" (server time). */
  readonly seen: string;
  /** Ready, Cooldown, Gone or Tagged. */
  readonly status: string;
  readonly grain: number | null;
  readonly timber: number | null;
  readonly herb: number | null;
  readonly total: number;
  /** The highest battle power seen for the player in any report. */
  readonly power: number | null;
  readonly hits: number;
  /** Who hit it last. */
  readonly by: string;
  /** While on cooldown: when it is ready again, server time ("2026-11-25 04:00"). */
  readonly readyAt: string | null;
  /** Gone or tagged: what the tracker said ("[ABC]"). */
  readonly note: string;
}

const num = z.number().nullable();
const farm = z.object({
  key: z.string().min(1),
  player: z.string().min(1),
  kingdom: z.string(),
  location: z.string(),
  seen: z.string(),
  status: z.string(),
  grain: num,
  timber: num,
  herb: num,
  total: z.number(),
  power: num,
  hits: z.number(),
  by: z.string(),
  readyAt: z.string().nullable(),
  note: z.string(),
});

export interface FarmList {
  readonly farms: readonly Farm[];
  readonly cooldownHours: number;
}

/** The answer of `farms`, or undefined when Carlos cannot read it. */
export function readFarmList(raw: unknown): FarmList | undefined {
  const parsed = z.object({ farms: z.array(farm), cooldownHours: z.number() }).safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** The answer of `hit`: the farm, now on cooldown. */
export function readHit(raw: unknown): Farm | undefined {
  const parsed = z.object({ farm }).safeParse(raw);
  return parsed.success ? parsed.data.farm : undefined;
}

export interface Retrace {
  readonly farm: Farm;
  readonly outcome: "moved" | "same" | "tagged" | "gone";
  readonly text: string;
}

/** The answer of `retrace`. */
export function readRetrace(raw: unknown): Retrace | undefined {
  const parsed = z.object({ farm, outcome: z.enum(["moved", "same", "tagged", "gone"]), text: z.string() }).safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export const FARMS_SHOWN = 15;
/** Discord allows 25 options in a select menu. */
export const MENU_MAX = 25;

/** 144000000 -> "144M", 8300000 -> "8.3M", 14900 -> "15K". */
export function short(n: number): string {
  const unit = (v: number, s: string) => `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}${s}`;
  if (n >= 1e9) return unit(n / 1e9, "B");
  if (n >= 1e6) return unit(n / 1e6, "M");
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

function resources(f: Farm): string {
  return (
    [
      ["grain", f.grain],
      ["timber", f.timber],
      ["herb", f.herb],
    ] as const
  )
    .filter(([, v]) => v !== null)
    .map(([name, v]) => `${name} ${short(v as number)}`)
    .join(" · ");
}

function place(f: Farm): string {
  return [f.kingdom ? `#${f.kingdom}` : "", f.location].filter(Boolean).join(" ") || "unknown";
}

/** One line of the list: number, name, total, resources, power, then where and the status. */
function farmLine(f: Farm, i: number): string {
  const power = f.power ? ` · power ${short(f.power)}` : "";
  const res = resources(f);
  const state =
    f.status === "Cooldown"
      ? `cooldown until ${f.readyAt ?? "?"}${f.by ? ` (hit by ${f.by})` : ""}`
      : f.status === "Ready"
        ? `ready, ${f.seen}`
        : `${f.status.toLowerCase()}${f.note ? ` ${f.note}` : ""}`;
  return `${i + 1}. **${f.player}** ${short(f.total)}${res ? ` (${res})` : ""}${power}\n   ${place(f)} · ${state}`;
}

/** Discord text of the list: the ready farms, then those on cooldown; gone and tagged ones only counted. */
export function farmsText(list: FarmList, shown = FARMS_SHOWN): string {
  const live = list.farms.filter((f) => f.status === "Ready" || f.status === "Cooldown");
  const lost = list.farms.length - live.length;
  if (!live.length) {
    return lost
      ? `No farms right now: ${lost} gone or in an alliance. Send new scout reports of players without an alliance tag.`
      : "No farms yet. Send scout reports of players without an alliance tag: Carlos lists them here once they are read.";
  }
  const ready = live.filter((f) => f.status === "Ready").length;
  const more = live.length > shown ? `\n…and ${live.length - shown} more on the Farms tab.` : "";
  return (
    `**Farms**: ${ready} ready, ${live.length - ready} on cooldown${lost ? `, ${lost} gone or tagged` : ""}. ` +
    `A hit rests a farm for ${list.cooldownHours} h.\n` +
    live.slice(0, shown).map(farmLine).join("\n") +
    more +
    (ready ? "\nPick the farm you attack below: it goes on cooldown under your name." : "")
  );
}

/** The options of the menu: the ready farms, richest first. */
export function farmOptions(list: FarmList): { label: string; value: string; description: string }[] {
  return list.farms
    .filter((f) => f.status === "Ready")
    .slice(0, MENU_MAX)
    .map((f) => ({
      label: `${f.player} · ${short(f.total)}`.slice(0, 100),
      value: f.key.slice(0, 100),
      description: `${place(f)}${f.power ? ` · power ${short(f.power)}` : ""}`.slice(0, 100),
    }));
}

/** The message about one farm after a hit or a retrace: where to go, and the state. */
export function farmCard(f: Farm, headline: string): string {
  const res = resources(f);
  const lines = [
    headline,
    `**${f.player}** at **${place(f)}** (${f.seen})`,
    `${short(f.total)}${res ? ` (${res})` : ""}${f.power ? ` · power ${short(f.power)}` : ""}`,
  ];
  if (f.status === "Cooldown") lines.push(`On cooldown until ${f.readyAt ?? "?"} server time${f.by ? `, hit by ${f.by}` : ""}.`);
  else if (f.status !== "Ready") lines.push(`Marked ${f.status}${f.note ? ` ${f.note}` : ""}.`);
  if (f.status !== "Tagged") lines.push("Not there? Press **Gone? Retrace**: the tracker finds where it went.");
  return lines.join("\n");
}
