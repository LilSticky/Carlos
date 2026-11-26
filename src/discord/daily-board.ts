import type { Client } from "discord.js";
import { dailyDue, dailyMessage, readDaily, type Daily } from "../coachman/daily.js";
import type { CallSheet } from "../exports/exports.js";
import type { DailyStore } from "../storage/daily-store.js";
import { announce } from "./announce.js";

export interface DailyDeps {
  readonly callSheet: CallSheet;
  readonly store: DailyStore;
  /** The announcement channel. */
  readonly channelId: string;
  /** The Discord account linked to a member name, or undefined. */
  readonly discordOf: (member: string) => string | undefined;
  readonly now: () => Date;
  readonly log: (line: string) => void;
}

const TICK_MS = 60_000;
const ASK_MS = 15 * 60_000;

/**
 * Asks the Coachman Express for the next stop every quarter hour and, every minute, posts its chat message once it
 * is due (some hours before set-up). The text is fetched again right before posting, so late changes count.
 * Returns a stop function.
 */
export function startDailyBoard(client: Client, d: DailyDeps): () => void {
  let next: Daily | undefined;
  let askedAt = 0;
  let lastError = "";
  let busy = false;
  const ask = async (): Promise<Daily | undefined> => {
    try {
      const read = readDaily(await d.callSheet("coachman", "daily", {}));
      if (!read) throw new Error("the sheet sent an answer Carlos cannot read");
      lastError = "";
      return read;
    } catch (e) {
      // the same problem (no coachman yet, week over) is logged once, not every quarter hour
      const message = e instanceof Error ? e.message : String(e);
      if (message !== lastError) d.log(`Daily post: ${message}`);
      lastError = message;
      return undefined;
    }
  };
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const now = d.now();
      if (!next || now.getTime() - askedAt >= ASK_MS) {
        next = await ask();
        askedAt = now.getTime();
      }
      if (!next || !dailyDue(next, d.store.posted(next.day), now)) return;
      const fresh = await ask();
      if (!fresh || fresh.day !== next.day) {
        next = fresh;
        return;
      }
      const { users, ...post } = dailyMessage(fresh, fresh.coach ? d.discordOf(fresh.coach) : undefined);
      const msg = await announce(client, d.channelId, { ...post, allowedMentions: { users } }, false);
      d.store.markPosted(fresh.day, d.channelId, msg.id, now);
      d.log(`Daily post for ${fresh.day} (${fresh.coach}${users.length ? ", mentioned" : ""}).`);
    } catch (e) {
      d.log(`Daily post: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      busy = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), TICK_MS);
  return () => clearInterval(timer);
}
