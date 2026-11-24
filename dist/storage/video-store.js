export class VideoStore {
    db;
    constructor(db) {
        this.db = db;
        db.exec(`
      CREATE TABLE IF NOT EXISTS video_posts (
        post_id    TEXT PRIMARY KEY,
        reply_id   TEXT,
        state      TEXT NOT NULL,
        kinds      TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
    `);
    }
    get(postId) {
        const row = this.db.prepare("SELECT post_id, reply_id, state, kinds FROM video_posts WHERE post_id = ?").get(postId);
        return row ? { postId: row.post_id, replyId: row.reply_id, state: row.state, kinds: row.kinds } : undefined;
    }
    /** Sets the state; a reply ID of undefined keeps the one stored. */
    set(postId, state, kinds, at, replyId) {
        this.db
            .prepare(`INSERT INTO video_posts (post_id, reply_id, state, kinds, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (post_id) DO UPDATE SET
           reply_id = CASE WHEN ? THEN excluded.reply_id ELSE video_posts.reply_id END,
           state = excluded.state, kinds = excluded.kinds, updated_at = excluded.updated_at`)
            .run(postId, replyId ?? null, state, kinds, at.toISOString(), replyId === undefined ? 0 : 1);
    }
}
//# sourceMappingURL=video-store.js.map