import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Which member of the alliance sheet a Discord account is. Kept only here, in Carlos's own database: the
 * sheets never learn Discord IDs.
 */
export interface Link {
  readonly discordId: string;
  readonly member: string;
  readonly linkedAt: string;
}

export function openDatabase(dataDir: string): DatabaseSync {
  mkdirSync(dataDir, { recursive: true });
  return prepare(new DatabaseSync(join(dataDir, "carlos.sqlite")));
}

export function openMemoryDatabase(): DatabaseSync {
  return prepare(new DatabaseSync(":memory:"));
}

function prepare(db: DatabaseSync): DatabaseSync {
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
  constructor(private readonly db: DatabaseSync) {}

  /** The member this Discord account is, or undefined. */
  memberOf(discordId: string): string | undefined {
    const row = this.db.prepare("SELECT member FROM links WHERE discord_id = ?").get(discordId) as
      | { member: string }
      | undefined;
    return row?.member;
  }

  /** The other Discord account already linked to this member (any case), or undefined. */
  holderOf(member: string, except: string): string | undefined {
    const row = this.db
      .prepare("SELECT discord_id FROM links WHERE member = ? COLLATE NOCASE AND discord_id <> ?")
      .get(member, except) as { discord_id: string } | undefined;
    return row?.discord_id;
  }

  link(discordId: string, member: string, at: Date): void {
    this.db
      .prepare(
        `INSERT INTO links (discord_id, member, linked_at) VALUES (?, ?, ?)
         ON CONFLICT (discord_id) DO UPDATE SET member = excluded.member, linked_at = excluded.linked_at`,
      )
      .run(discordId, member, at.toISOString());
  }

  /** Frees a member name from every Discord account that holds it. */
  release(member: string): void {
    this.db.prepare("DELETE FROM links WHERE member = ? COLLATE NOCASE").run(member);
  }
}
