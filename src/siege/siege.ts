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

/**
 * The plan as embeds (each within Discord's limits) and the helpers to mention. Helpers are grouped, so everyone
 * finds their own line: who sends which squad where.
 */
export function planEmbeds(plan: SiegePlan): { title: string; description: string; color: number }[] {
  const byHelper = new Map<string, string[]>();
  for (const o of plan.orders) {
    const lines = byHelper.get(o.helper) ?? [];
    lines.push(`${o.squad} to **${o.target}**${o.distance === null ? "" : ` (${o.distance} tiles)`}`);
    byHelper.set(o.helper, lines);
  }
  const sends = [...byHelper.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([helper, lines]) => `**${helper}**: ${lines.join(", ")}`);
  const waves = plan.attacked.map(
    (t) => `${t.name}: ${t.alone} alone${t.withHelp > t.alone ? `, ${t.withHelp} with help` : ""}${t.signedUp ? "" : " (not signed up)"}`,
  );
  const intro = [
    `Starts at ${stamp(plan.start)} (${stamp(plan.start, "R")}).`,
    plan.summary,
    sends.length ? "Send these squads as reinforcements before the first wave:" : "No squads to send: nobody who signed up can add a wave.",
  ].join("\n");
  const embeds: { title: string; description: string; color: number }[] = [];
  let title = `Undead Siege - Stage ${plan.stage}: defense plan`;
  let body = intro;
  const push = (line: string, heading?: string) => {
    const add = (heading ? `\n\n${heading}\n` : "\n") + line;
    if (body.length + add.length > 3900) {
      embeds.push({ title, description: body, color: GREEN });
      title = `Undead Siege - Stage ${plan.stage} (continued)`;
      body = heading ? `${heading}\n${line}` : line;
    } else body += add;
  };
  sends.forEach((l, i) => push(l, i === 0 ? "**Reinforcements**" : undefined));
  waves.forEach((l, i) => push(l, i === 0 ? "**Waves held (of 20)**" : undefined));
  push(`Positions: ${plan.positions}`, " ");
  embeds.push({ title, description: body, color: GREEN });
  return embeds.slice(0, 10);
}

/** The helpers of a plan, for the mention line. */
export function planHelpers(plan: SiegePlan): string[] {
  return [...new Set(plan.orders.map((o) => o.helper))];
}
