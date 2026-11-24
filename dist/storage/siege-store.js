/** What Carlos posted for each Undead Siege, so a restart neither posts twice nor loses the invitation to update. */
export class SiegeStore {
    db;
    constructor(db) {
        this.db = db;
        db.exec(`
      CREATE TABLE IF NOT EXISTS siege_posts (
        run               TEXT PRIMARY KEY,
        channel_id        TEXT NOT NULL,
        invite_message_id TEXT,
        plan_posted_at    TEXT
      ) STRICT;
    `);
    }
    posts(run) {
        const row = this.db.prepare("SELECT channel_id, invite_message_id, plan_posted_at FROM siege_posts WHERE run = ?").get(run);
        return { channelId: row?.channel_id ?? null, inviteMessageId: row?.invite_message_id ?? null, planPosted: !!row?.plan_posted_at };
    }
    invited(run, channelId, messageId) {
        this.db
            .prepare(`INSERT INTO siege_posts (run, channel_id, invite_message_id) VALUES (?, ?, ?)
         ON CONFLICT (run) DO UPDATE SET channel_id = excluded.channel_id, invite_message_id = excluded.invite_message_id`)
            .run(run, channelId, messageId);
    }
    planned(run, channelId, at) {
        this.db
            .prepare(`INSERT INTO siege_posts (run, channel_id, plan_posted_at) VALUES (?, ?, ?)
         ON CONFLICT (run) DO UPDATE SET plan_posted_at = excluded.plan_posted_at`)
            .run(run, channelId, at.toISOString());
    }
}
//# sourceMappingURL=siege-store.js.map