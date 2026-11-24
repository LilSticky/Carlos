import type { DatabaseSync } from "node:sqlite";
import type { SiegePosts } from "../siege/siege.js";

/** What Carlos posted for each Undead Siege, so a restart neither posts twice nor loses the invitation to update. */
export class SiegeStore {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS siege_posts (
        run               TEXT PRIMARY KEY,
        channel_id        TEXT NOT NULL,
        invite_message_id TEXT,
        plan_posted_at    TEXT
      ) STRICT;
    `);
  }

  posts(run: string): SiegePosts & { channelId: string | null } {
    const row = this.db.prepare("SELECT channel_id, invite_message_id, plan_posted_at FROM siege_posts WHERE run = ?").get(run) as
      | { channel_id: string; invite_message_id: string | null; plan_posted_at: string | null }
      | undefined;
    return { channelId: row?.channel_id ?? null, inviteMessageId: row?.invite_message_id ?? null, planPosted: !!row?.plan_posted_at };
  }

  invited(run: string, channelId: string, messageId: string): void {
    this.db
      .prepare(
        `INSERT INTO siege_posts (run, channel_id, invite_message_id) VALUES (?, ?, ?)
         ON CONFLICT (run) DO UPDATE SET channel_id = excluded.channel_id, invite_message_id = excluded.invite_message_id`,
      )
      .run(run, channelId, messageId);
  }

  planned(run: string, channelId: string, at: Date): void {
    this.db
      .prepare(
        `INSERT INTO siege_posts (run, channel_id, plan_posted_at) VALUES (?, ?, ?)
         ON CONFLICT (run) DO UPDATE SET plan_posted_at = excluded.plan_posted_at`,
      )
      .run(run, channelId, at.toISOString());
  }
}
