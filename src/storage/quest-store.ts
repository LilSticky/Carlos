import type { DatabaseSync } from "node:sqlite";

/** Which repeating Intel Quests Carlos announced on which server day ("2026-11-26|Barracks check"), so a restart never posts twice. */
export class QuestStore {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quest_posts (
        key        TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        posted_at  TEXT NOT NULL
      ) STRICT;
    `);
  }

  posted(key: string): boolean {
    return !!this.db.prepare("SELECT 1 FROM quest_posts WHERE key = ?").get(key);
  }

  markPosted(key: string, channelId: string, messageId: string, at: Date): void {
    this.db
      .prepare("INSERT OR REPLACE INTO quest_posts (key, channel_id, message_id, posted_at) VALUES (?, ?, ?, ?)")
      .run(key, channelId, messageId, at.toISOString());
  }
}
