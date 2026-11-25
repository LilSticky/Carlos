import { z } from "zod";

/**
 * Undead Siege: the Undead Siege sheet (rebirth-sheets siege/BotActions.js) knows when the next siege starts, who
 * signed up and, on request, the defense plan. Carlos posts one invitation with a Participate button before the start,
 * signs up whoever presses it and posts the plan shortly before the start. The plan itself is made in the sheet.
 */
export interface NextSiege {
  /** The sheet's key of the siege: its start in server time ("2026-11-26 20:00"). */
  readonly run: string;
  readonly start: Date;
  readonly stage: number | null;
  readonly inviteAt: Date;
  readonly planAt: Date;
  readonly signedUp: readonly string[];
}

const iso = z.string().transform((s, ctx) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) ctx.addIssue({ code: "custom", message: "not a time" });
  return d;
});
const nextAnswer = z.union([
  z.object({ run: z.null() }),
  z.object({
    run: z.string().min(1),
    start: iso,
    stage: z.number().nullable(),
    inviteAt: iso,
    planAt: iso,
    signedUp: z.array(z.string()),
  }),
]);

/** The sheet's `next` answer: the siege, null when none is planned, undefined when unreadable. */
export function readNext(raw: unknown): NextSiege | null | undefined {
  const p = nextAnswer.safeParse(raw);
  if (!p.success) return undefined;
  return p.data.run === null ? null : (p.data as NextSiege);
}

const joinAnswer = z.object({ run: z.string(), added: z.boolean(), signedUp: z.array(z.string()) });
export type JoinAnswer = z.infer<typeof joinAnswer>;
export function readJoin(raw: unknown): JoinAnswer | undefined {
  const p = joinAnswer.safeParse(raw);
  return p.success ? p.data : undefined;
}

const planAnswer = z.object({
  run: z.string(),
  start: iso,
  stage: z.number(),
  summary: z.string(),
  positions: z.string(),
  signedUp: z.array(z.string()),
  attacked: z.array(
    z.object({ name: z.string(), signedUp: z.boolean(), alone: z.number(), withHelp: z.number(), helpers: z.array(z.string()) }),
  ),
  skipped: z.array(z.object({ name: z.string(), why: z.string() })),
  orders: z.array(z.object({ helper: z.string(), squad: z.string(), target: z.string(), distance: z.number().nullable() })),
});
export type SiegePlan = z.infer<typeof planAnswer>;
export function readPlan(raw: unknown): SiegePlan | undefined {
  const p = planAnswer.safeParse(raw);
  return p.success ? p.data : undefined;
}

/** What Carlos has posted for a siege (kept in its database, so a restart posts nothing twice). */
export interface SiegePosts {
  readonly inviteMessageId: string | null;
  readonly planPosted: boolean;
}

/** How long after the start a missed plan is still posted (the first waves take a while). */
export const PLAN_GRACE_MS = 15 * 60_000;

/**
 * What is due now: the invitation from its time until the start (unless the plan is out already), the plan from
 * its time until shortly after the start.
 */
export function dueNow(next: NextSiege, posts: SiegePosts, now: Date): "invite" | "plan" | null {
  const t = now.getTime();
  if (!posts.planPosted && t >= next.planAt.getTime() && t < next.start.getTime() + PLAN_GRACE_MS) return "plan";
  if (!posts.inviteMessageId && !posts.planPosted && t >= next.inviteAt.getTime() && t < next.start.getTime()) return "invite";
  return null;
}

/** Discord's own time markup: each reader sees their local time. */
export const stamp = (d: Date, style: "t" | "R" | "F" = "t"): string => `<t:${Math.floor(d.getTime() / 1000)}:${style}>`;

export const SIEGE_BUTTON = "siege:";
const GREEN = 0x356854;

function list(names: readonly string[], max = 1000): string {
  if (!names.length) return "Nobody yet.";
  let out = "";
  for (const [i, n] of names.entries()) {
    const next = (out ? out + ", " : "") + n;
    if (next.length > max) return `${out} and ${names.length - i} more`;
    out = next;
  }
  return out;
}

/** The invitation embed; `closed` once the plan is out. */
export function inviteEmbed(next: NextSiege, closed = false) {
  const stage = next.stage ? ` - Stage ${next.stage}` : "";
  return {
    title: `Undead Siege${stage}`,
    color: GREEN,
    description: closed
      ? `Started ${stamp(next.start, "R")}. Sign-ups are closed; the defense plan is posted below.`
      : [
          `Starts at ${stamp(next.start)} (${stamp(next.start, "R")}).`,
          "Will you be online at the start? Press **Participate**: your spare squads are planned in to reinforce the members who need them most.",
          `The defense plan follows ${stamp(next.planAt, "R")}. Do not relocate until the siege is over.`,
        ].join("\n\n"),
    fields: [{ name: `Signed up (${next.signedUp.length})`, value: list(next.signedUp) }],
  };
}

export interface PlanEmbed {
  readonly title?: string;
  readonly description?: string;
  readonly color: number;
  readonly fields: { name: string; value: string }[];
  readonly footer?: { text: string };
}

const WAVES = 20;
/** How many of the weakest unhelped members the post names; the rest are counted. */
const AT_RISK_NAMED = 10;

/** Lines into field values of at most 1024 characters; the first field gets `name`, the others "(continued)". */
function fields(name: string, lines: readonly string[]): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  let value = "";
  for (const line of lines) {
    if (value && value.length + 1 + line.length > 1024) {
      out.push({ name: out.length ? `${name} (continued)` : name, value });
      value = "";
    }
    value = value ? `${value}\n${line}` : line.slice(0, 1024);
  }
  if (value) out.push({ name: out.length ? `${name} (continued)` : name, value });
  return out;
}

/**
 * The plan as a short post: what to do first (each helper's squads, one line per helper), then who gets help, then
 * the weakest members nobody could help. The full list of every member's waves stays in the sheet.
 */
export function planEmbeds(plan: SiegePlan): PlanEmbed[] {
  const byHelper = new Map<string, string[]>();
  for (const o of plan.orders) {
    const list = byHelper.get(o.helper) ?? [];
    list.push(`${o.squad} to ${o.target}${o.distance === null ? "" : ` (${o.distance} tiles)`}`);
    byHelper.set(o.helper, list);
  }
  const sends = [...byHelper.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([helper, list]) => `**${helper}**: ${list.join(" · ")}`);
  const helped = plan.attacked
    .filter((t) => t.withHelp > t.alone)
    .sort((a, b) => a.alone - b.alone)
    .map((t) => `${t.name}: ${t.alone} → ${t.withHelp} waves`);
  const atRisk = plan.attacked.filter((t) => t.withHelp === t.alone && t.alone < WAVES).sort((a, b) => a.alone - b.alone);
  const alone = plan.attacked.reduce((n, t) => n + t.alone, 0);
  const withHelp = plan.attacked.reduce((n, t) => n + t.withHelp, 0);
  const total = plan.attacked.length * WAVES;

  const all = [
    ...(sends.length
      ? fields("Send your squads", sends)
      : [{ name: "Send your squads", value: "None: nobody who signed up can add a wave." }]),
    ...(helped.length ? fields("Who gets help", helped) : []),
    ...(atRisk.length
      ? [
          {
            name: `Still falling before wave ${WAVES} (${atRisk.length})`,
            value:
              atRisk
                .slice(0, AT_RISK_NAMED)
                .map((t) => `${t.name} ${t.alone}`)
                .join(" · ") + (atRisk.length > AT_RISK_NAMED ? ` · and ${atRisk.length - AT_RISK_NAMED} more` : ""),
          },
        ]
      : []),
  ];
  const head: PlanEmbed = {
    title: `Undead Siege - Stage ${plan.stage}: defense plan`,
    color: GREEN,
    description: [
      `Starts at ${stamp(plan.start)} (${stamp(plan.start, "R")}).`,
      "Send your squads as reinforcements **before the first wave**, and do not relocate.",
      "",
      `With this plan: **${withHelp} of ${total} waves** (${alone} without help).`,
    ].join("\n"),
    fields: [],
  };
  // Discord: 25 fields and 6000 characters per embed
  const embeds: PlanEmbed[] = [head];
  let size = (head.title?.length ?? 0) + (head.description?.length ?? 0);
  for (const f of all) {
    const last = embeds[embeds.length - 1]!;
    if (last.fields.length >= 25 || size + f.name.length + f.value.length > 5500) {
      embeds.push({ color: GREEN, fields: [] });
      size = 0;
    }
    embeds[embeds.length - 1]!.fields.push(f);
    size += f.name.length + f.value.length;
  }
  const footer = { text: `Positions: ${plan.positions} (server time). Every member's waves are in the Undead Siege sheet.` };
  embeds[embeds.length - 1] = { ...embeds[embeds.length - 1]!, footer };
  return embeds.slice(0, 10);
}

/** The helpers of a plan, for the mention line. */
export function planHelpers(plan: SiegePlan): string[] {
  return [...new Set(plan.orders.map((o) => o.helper))];
}
