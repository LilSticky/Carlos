/** Which repeating Intel Quests Carlos announced on which server day ("2026-11-26|Barracks check"), so a restart never posts twice. */
export class QuestStore {
    db;
    constructor(db) {
        this.db = db;
        db.exec(`
      CREATE TABLE IF NOT EXISTS quest_posts (
        key        TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        posted_at  TEXT NOT NULL
      ) STRICT;
    `);
    }
    posted(key) {
        return !!this.db.prepare("SELECT 1 FROM quest_posts WHERE key = ?").get(key);
    }
    markPosted(key, channelId, messageId, at) {
        this.db
            .prepare("INSERT OR REPLACE INTO quest_posts (key, channel_id, message_id, posted_at) VALUES (?, ?, ?, ?)")
            .run(key, channelId, messageId, at.toISOString());
    }
}
//# sourceMappingURL=quest-store.js.map