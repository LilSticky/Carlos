import type { DatabaseSync } from "node:sqlite";

/** Which days Carlos posted the daily caravan message for, so a restart never posts it twice. */
export class DailyStore {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_posts (
        day        TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        posted_at  TEXT NOT NULL
      ) STRICT;
    `);
  }

  posted(day: string): boolean {
    return !!this.db.prepare("SELECT 1 FROM daily_posts WHERE day = ?").get(day);
  }

  markPosted(day: string, channelId: string, messageId: string, at: Date): void {
    this.db
      .prepare("INSERT OR REPLACE INTO daily_posts (day, channel_id, message_id, posted_at) VALUES (?, ?, ?, ?)")
      .run(day, channelId, messageId, at.toISOString());
  }
}
