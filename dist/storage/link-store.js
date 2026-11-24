import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
export function openDatabase(dataDir) {
    mkdirSync(dataDir, { recursive: true });
    return prepare(new DatabaseSync(join(dataDir, "carlos.sqlite")));
}
export function openMemoryDatabase() {
    return prepare(new DatabaseSync(":memory:"));
}
function prepare(db) {
    db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS links (
      discord_id TEXT PRIMARY KEY,
      member     TEXT NOT NULL,
      linked_at  TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS links_member ON links (member COLLATE NOCASE);
  `);
    return db;
}
export class LinkStore {
    db;
    constructor(db) {
        this.db = db;
    }
    /** The member this Discord account is, or undefined. */
    memberOf(discordId) {
        const row = this.db.prepare("SELECT member FROM links WHERE discord_id = ?").get(discordId);
        return row?.member;
    }
    /** The other Discord account already linked to this member (any case), or undefined. */
    holderOf(member, except) {
        const row = this.db
            .prepare("SELECT discord_id FROM links WHERE member = ? COLLATE NOCASE AND discord_id <> ?")
            .get(member, except);
        return row?.discord_id;
    }
    link(discordId, member, at) {
        this.db
            .prepare(`INSERT INTO links (discord_id, member, linked_at) VALUES (?, ?, ?)
         ON CONFLICT (discord_id) DO UPDATE SET member = excluded.member, linked_at = excluded.linked_at`)
            .run(discordId, member, at.toISOString());
    }
    /** Frees a member name from every Discord account that holds it. */
    release(member) {
        this.db.prepare("DELETE FROM links WHERE member = ? COLLATE NOCASE").run(member);
    }
}
//# sourceMappingURL=link-store.js.map