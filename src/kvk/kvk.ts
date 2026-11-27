import { z } from "zod";
import { stamp } from "../siege/siege.js";

/**
 * The KvK vote: KvK Planning (rebirth-sheets kvk/BotActions.js, DiscordVote.js) knows the coming Day VI battle and
 * who answered. Carlos posts one vote card with Participate, Stay out and Don't know yet before it, writes every press
 * into the sheet (a Discord answer wins over the imported in-game vote; Don't know yet shows the member read the card,
 * but counts like no answer for the battle), and when Day VI starts closes the card and posts the
 * KvK Readiness card: the vote and the battle strength in short.
 */
export interface NextKvk {
  /** The battle day (Day VI, server time), the sheet's key: "2026-11-28". */
  readonly day: string;
  readonly inviteAt: Date;
  /** Day VI starts: the vote closes, the readiness card is due. */
  readonly closeAt: Date;
  readonly battleAt: Date;
  readonly open: boolean;
  readonly yes: readonly string[];
  readonly no: readonly string[];
  /** Don't know yet. */
  readonly maybe: readonly string[];
  readonly members: number;
}

const iso = z.string().transform((s, ctx) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) ctx.addIssue({ code: "custom", message: "not a time" });
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
  maybe: z.array(z.string()).default([]),
  members: z.number(),
});
export function readKvkNext(raw: unknown): NextKvk | undefined {
  const p = nextAnswer.safeParse(raw);
  return p.success ? p.data : undefined;
}

const answerAnswer = z.object({
  day,
  vote: z.enum(["Yes", "No", "Maybe"]),
  changed: z.boolean(),
  yes: z.array(z.string()),
  no: z.array(z.string()),
  maybe: z.array(z.string()).default([]),
});
export type KvkAnswer = z.infer<typeof answerAnswer>;
export function readKvkAnswer(raw: unknown): KvkAnswer | undefined {
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
  /** Voted Don't know yet: in `maybe` like those without an answer. */
  unsure: z.array(z.string()).default([]),
});
export type KvkReadiness = z.infer<typeof readinessAnswer>;
export function readKvkReadiness(raw: unknown): KvkReadiness | undefined {
  const p = readinessAnswer.safeParse(raw);
  return p.success ? p.data : undefined;
}

/** What Carlos has posted for a battle (kept in its database, so a restart posts nothing twice). */
export interface KvkPosts {
  readonly inviteMessageId: string | null;
  readonly readinessPosted: boolean;
}

/** How long after Day VI starts a missed readiness card is still posted: until the battle is over. */
export const READINESS_GRACE_MS = 18 * 3600_000;

/** What is due now: the vote card from its time while the vote is open, the readiness card once it closed. */
export function kvkDue(next: NextKvk, posts: KvkPosts, now: Date): "invite" | "readiness" | null {
  const t = now.getTime();
  if (!posts.readinessPosted && t >= next.closeAt.getTime() && t < next.closeAt.getTime() + READINESS_GRACE_MS) return "readiness";
  if (!posts.inviteMessageId && t >= next.inviteAt.getTime() && t < next.closeAt.getTime()) return "invite";
  return null;
}

export const KVK_YES = "kvk-yes:";
export const KVK_NO = "kvk-no:";
export const KVK_MAYBE = "kvk-maybe:";
const GREEN = 0x356854;

function names(list: readonly string[], max = 1000): string {
  if (!list.length) return "Nobody yet.";
  let out = "";
  for (const [i, n] of list.entries()) {
    const next = (out ? out + ", " : "") + n;
    if (next.length > max) return `${out} and ${list.length - i} more`;
    out = next;
  }
  return out;
}

/** "56.1M" */
export function millions(n: number): string {
  return `${(n / 1e6).toFixed(1)}M`;
}

/** The answer lists of the vote card. */
export function voteFields(yes: readonly string[], no: readonly string[], maybe: readonly string[] = []) {
  return [
    { name: `Participate (${yes.length})`, value: names(yes) },
    { name: `Stay out (${no.length})`, value: names(no) },
    { name: `Don't know yet (${maybe.length})`, value: names(maybe) },
  ];
}

/** The vote card; `closed` once Day VI started. */
export function kvkInviteEmbed(next: NextKvk, closed = false) {
  return {
    title: "KvK: Royal City battle on Day VI",
    color: GREEN,
    description: closed
      ? "The vote is closed. The KvK Readiness card is posted below."
      : [
          `The battle starts at ${stamp(next.battleAt)} on ${stamp(next.battleAt, "F")}.`,
          "Will you make it? Press **Participate** or **Stay out**, or **Don't know yet** if you can't tell yet. " +
            "You can change your answer until Day VI starts " +
            `(${stamp(next.closeAt, "R")}).`,
          "Your answer here counts over the in-game vote. Please vote in game too: it shows your Might.",
        ].join("\n\n"),
    fields: voteFields(next.yes, next.no, next.maybe),
  };
}

/** The KvK Readiness card: the vote and the battle strength in short. */
export function readinessEmbed(r: KvkReadiness) {
  const lines = [
    `Battle at ${stamp(r.battleAt)} (${stamp(r.battleAt, "R")}).`,
    "",
    `**Participate: ${r.yes.count}** · ${millions(r.yes.might)} Might`,
    `Stay out: ${r.no.count} · ${millions(r.no.might)} Might`,
    `No answer or don't know yet: ${r.maybe.count} · ${millions(r.maybe.might)} Might` +
      (r.unsure.length ? ` (${r.unsure.length} don't know yet)` : ""),
  ];
  const fields: { name: string; value: string; inline?: boolean }[] = [];
  if (r.readiness) {
    const ready = r.readiness;
    fields.push({
      name: "Likely to fight",
      value:
        `${ready.likely.count} of ${r.yes.count} · ${millions(ready.likely.might)} Might (readiness ${ready.min} or more)` +
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
