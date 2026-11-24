import { z } from "zod";
import type { SheetKey } from "../config.js";
import { SheetError } from "../sheet/sheet.js";

/**
 * The texts the sheets make for the chats, as their menus export them. The sheet builds every text (Bot.js,
 * BotActions.js); Carlos only fetches and posts it.
 */
export interface ExportDef {
  /** The choice value in the slash command. */
  readonly key: string;
  readonly label: string;
  readonly sheet: SheetKey;
  readonly action: string;
  readonly args?: Readonly<Record<string, unknown>>;
  /** Only R4 and R5 may see it (texts they send on, like the driver reminder or a vote list). */
  readonly officersOnly: boolean;
  /** Written for Discord (Markdown) rather than for the in-game chat. */
  readonly discord: boolean;
}

export const EXPORTS = {
  coachman: [
    { key: "schedule", label: "Weekly schedule", sheet: "coachman", action: "schedule", officersOnly: false, discord: false },
    { key: "daily", label: "Daily chat message", sheet: "coachman", action: "daily", officersOnly: false, discord: false },
    { key: "notice", label: "Nominee notice", sheet: "coachman", action: "notice", officersOnly: false, discord: false },
    { key: "rules", label: "House rules", sheet: "coachman", action: "rules", officersOnly: false, discord: false },
    { key: "guide", label: "Driver guide", sheet: "coachman", action: "guide", officersOnly: false, discord: false },
    { key: "driver", label: "Driver reminder (officers)", sheet: "coachman", action: "driver", officersOnly: true, discord: false },
  ],
  events: [
    { key: "week", label: "This week's events", sheet: "events", action: "week", officersOnly: false, discord: false },
    { key: "ad-today", label: "AD notice: today", sheet: "events", action: "ad", args: { offset: 0 }, officersOnly: false, discord: false },
    { key: "ad-tomorrow", label: "AD notice: tomorrow", sheet: "events", action: "ad", args: { offset: 1 }, officersOnly: false, discord: false },
    { key: "elixir", label: "Elixir Scramble teams", sheet: "events", action: "elixir", officersOnly: false, discord: false },
  ],
  kvk: [{ key: "roster", label: "KvK roster", sheet: "kvk", action: "roster", officersOnly: false, discord: true }],
  vote: [
    { key: "nominees", label: "Special nomination vote", sheet: "stats", action: "votes", officersOnly: true, discord: false },
    { key: "guards", label: "Guard vote", sheet: "stats", action: "guards", officersOnly: true, discord: false },
  ],
} as const satisfies Record<string, readonly ExportDef[]>;

export type ExportCommand = keyof typeof EXPORTS;

export function findExport(command: ExportCommand, key: string | null): ExportDef | undefined {
  const list: readonly ExportDef[] = EXPORTS[command];
  return key ? list.find((d) => d.key === key) : list[0];
}

const result = z.union([
  z.object({ text: z.string(), draft: z.boolean().optional(), lockedNow: z.boolean().optional() }),
  z.object({ parts: z.array(z.string()), title: z.string().optional() }),
]);

export type ExportOutcome =
  | { readonly kind: "officers-only" }
  | { readonly kind: "draft" }
  | {
      readonly kind: "shown";
      readonly def: ExportDef;
      readonly parts: readonly string[];
      readonly post: boolean;
      readonly draft: boolean;
      readonly lockedNow: boolean;
    }
  | { readonly kind: "failed"; readonly error: string; readonly setup: boolean };

export type CallSheet = (sheet: SheetKey, action: string, args: Record<string, unknown>) => Promise<unknown>;

/**
 * Fetches one export. Posting in the channel is for officers; so are officer texts. A member never sees the
 * schedule while it is a draft: it may still change. Posting the schedule counts as its first export and locks it in.
 */
export async function runExport(
  def: ExportDef,
  request: { readonly post: boolean; readonly isOfficer: () => Promise<boolean> },
  call: CallSheet,
): Promise<ExportOutcome> {
  if ((def.officersOnly || request.post) && !(await request.isOfficer())) return { kind: "officers-only" };
  let raw: unknown;
  try {
    raw = await call(def.sheet, def.action, { ...def.args, ...(request.post ? { post: true } : {}) });
  } catch (e) {
    return e instanceof SheetError
      ? { kind: "failed", error: e.message, setup: e.setup }
      : { kind: "failed", error: "Something went wrong. Please try again.", setup: true };
  }
  const parsed = result.safeParse(raw);
  if (!parsed.success) return { kind: "failed", error: "The sheet sent an answer Carlos cannot read.", setup: true };
  const r = parsed.data;
  const parts = "parts" in r ? r.parts.filter((p) => p.trim()) : [r.text];
  const draft = "text" in r && r.draft === true;
  if (draft && !(await request.isOfficer())) return { kind: "draft" };
  return { kind: "shown", def, parts, post: request.post, draft, lockedNow: "text" in r && r.lockedNow === true };
}

export const DISCORD_LIMIT = 2000;

/**
 * Discord messages for the parts: each part on its own, longer ones split at line breaks. In-game chat texts
 * shown only to the asker go into a code block, so they copy cleanly into the game.
 */
export function toMessages(parts: readonly string[], codeBlock: boolean, limit = DISCORD_LIMIT): string[] {
  const room = codeBlock ? limit - 8 : limit;
  const out: string[] = [];
  for (const part of parts) {
    const text = codeBlock ? part.replace(/```/g, "'''") : part;
    for (const piece of splitLines(text, room)) out.push(codeBlock ? "```\n" + piece + "\n```" : piece);
  }
  return out;
}

function splitLines(text: string, room: number): string[] {
  const pieces: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    for (const chunk of line.length > room ? line.match(new RegExp(`[\\s\\S]{1,${room}}`, "g")) ?? [] : [line]) {
      const next = current ? current + "\n" + chunk : chunk;
      if (next.length > room) {
        pieces.push(current);
        current = chunk;
      } else {
        current = next;
      }
    }
  }
  if (current.trim()) pieces.push(current);
  return pieces;
}
