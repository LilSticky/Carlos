import { createHash } from "node:crypto";
import { ChannelType, type AnyThreadChannel, type Client } from "discord.js";
import type { CallSheet } from "../exports/exports.js";
import { readScores, scoreEmbeds, stampEmbeds } from "../scores/scores.js";
import type { BoardStore } from "../storage/board-store.js";

export interface ScoresDeps {
  readonly callSheet: CallSheet;
  readonly store: BoardStore;
  /** The guide forum (GUIDE_FORUM_ID). */
  readonly forumId: string;
  readonly uploadChannelId: string;
  readonly now: () => Date;
  readonly log: (line: string) => void;
}

const KEY = "scores";
const TITLE = "Intel Scoreboard";
const TICK_MS = 15 * 60_000;
const NO_PINGS = { parse: [] as never[] };

async function findThread(client: Client, id: string): Promise<AnyThreadChannel | null> {
  try {
    const ch = await client.channels.fetch(id);
    return ch?.isThread() ? ch : null;
  } catch {
    return null;
  }
}

/**
 * Keeps one post in the guide forum with the intel scoreboards: asks Alliance Members every quarter hour and edits
 * the post when the points changed. Makes the post when it is missing (first start, or deleted by hand).
 * Returns a stop function.
 */
export function startScoresBoard(client: Client, d: ScoresDeps): () => void {
  let lastError = "";
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const data = readScores(await d.callSheet("members", "scores", {}));
      if (!data) throw new Error("the sheet sent an answer Carlos cannot read");
      lastError = "";
      const embeds = scoreEmbeds(data, d.uploadChannelId);
      const hash = createHash("sha256").update(JSON.stringify(embeds)).digest("hex");
      const saved = d.store.get(KEY);
      const thread = saved ? await findThread(client, saved.threadId) : null;
      const message = thread && saved ? await thread.messages.fetch(saved.messageId).catch(() => null) : null;
      if (saved && message && saved.hash === hash) return;

      const body = { embeds: stampEmbeds(embeds, d.now()), allowedMentions: NO_PINGS };
      if (thread && message) {
        if (thread.archived) await thread.setArchived(false);
        await message.edit(body);
        d.store.save(KEY, { threadId: thread.id, messageId: message.id, hash });
        d.log("Scoreboard post: updated.");
        return;
      }
      const forum = await client.channels.fetch(d.forumId);
      if (forum?.type !== ChannelType.GuildForum) throw new Error(`channel ${d.forumId} is not a forum channel`);
      const tags = forum.availableTags.filter((t) => ["scoreboard", "intel"].includes(t.name.toLowerCase())).map((t) => t.id);
      const created = await forum.threads.create({ name: TITLE, message: body, appliedTags: tags.slice(0, 5) });
      d.store.save(KEY, { threadId: created.id, messageId: created.id, hash }); // the starter message has the thread's ID
      d.log("Scoreboard post: posted.");
    } catch (e) {
      // the same problem is logged once, not every quarter hour
      const text = e instanceof Error ? e.message : String(e);
      if (text !== lastError) d.log(`Scoreboard post: ${text}`);
      lastError = text;
    } finally {
      busy = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), TICK_MS);
  return () => clearInterval(timer);
}
