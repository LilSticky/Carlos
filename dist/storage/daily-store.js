/** Which days Carlos posted the daily caravan message for, so a restart never posts it twice. */
export class DailyStore {
    db;
    constructor(db) {
        this.db = db;
        db.exec(`
      CREATE TABLE IF NOT EXISTS daily_posts (
        day        TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        posted_at  TEXT NOT NULL
      ) STRICT;
    `);
    }
    posted(day) {
        return !!this.db.prepare("SELECT 1 FROM daily_posts WHERE day = ?").get(day);
    }
    markPosted(day, channelId, messageId, at) {
        this.db
            .prepare("INSERT OR REPLACE INTO daily_posts (day, channel_id, message_id, posted_at) VALUES (?, ?, ?, ?)")
            .run(day, channelId, messageId, at.toISOString());
    }
}
//# sourceMappingURL=daily-store.js.map