/** Which forum post Carlos made for each guide topic, so a restart edits it instead of posting it again. */
export class GuideStore {
    db;
    constructor(db) {
        this.db = db;
        db.exec(`
      CREATE TABLE IF NOT EXISTS guide_posts (
        key         TEXT PRIMARY KEY,
        thread_id   TEXT NOT NULL,
        message_ids TEXT NOT NULL,
        hash        TEXT NOT NULL
      ) STRICT;
    `);
    }
    get(key) {
        const row = this.db.prepare("SELECT thread_id, message_ids, hash FROM guide_posts WHERE key = ?").get(key);
        return row && { threadId: row.thread_id, messageIds: JSON.parse(row.message_ids), hash: row.hash };
    }
    keys() {
        return this.db.prepare("SELECT key FROM guide_posts ORDER BY key").all().map((r) => r.key);
    }
    save(key, r) {
        this.db
            .prepare(`INSERT INTO guide_posts (key, thread_id, message_ids, hash) VALUES (?, ?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET thread_id = excluded.thread_id, message_ids = excluded.message_ids, hash = excluded.hash`)
            .run(key, r.threadId, JSON.stringify(r.messageIds), r.hash);
    }
    remove(key) {
        this.db.prepare("DELETE FROM guide_posts WHERE key = ?").run(key);
    }
}
//# sourceMappingURL=guide-store.js.map