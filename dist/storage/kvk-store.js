/** What Carlos posted for each KvK battle, so a restart neither posts twice nor loses the vote card to update. */
export class KvkStore {
    db;
    constructor(db) {
        this.db = db;
        db.exec(`
      CREATE TABLE IF NOT EXISTS kvk_posts (
        day                 TEXT PRIMARY KEY,
        channel_id          TEXT NOT NULL,
        invite_message_id   TEXT,
        readiness_posted_at TEXT
      ) STRICT;
    `);
    }
    posts(day) {
        const row = this.db.prepare("SELECT channel_id, invite_message_id, readiness_posted_at FROM kvk_posts WHERE day = ?").get(day);
        return { channelId: row?.channel_id ?? null, inviteMessageId: row?.invite_message_id ?? null, readinessPosted: !!row?.readiness_posted_at };
    }
    invited(day, channelId, messageId) {
        this.db
            .prepare(`INSERT INTO kvk_posts (day, channel_id, invite_message_id) VALUES (?, ?, ?)
         ON CONFLICT (day) DO UPDATE SET channel_id = excluded.channel_id, invite_message_id = excluded.invite_message_id`)
            .run(day, channelId, messageId);
    }
    readinessPosted(day, channelId, at) {
        this.db
            .prepare(`INSERT INTO kvk_posts (day, channel_id, readiness_posted_at) VALUES (?, ?, ?)
         ON CONFLICT (day) DO UPDATE SET readiness_posted_at = excluded.readiness_posted_at`)
            .run(day, channelId, at.toISOString());
    }
}
//# sourceMappingURL=kvk-store.js.map