import type { DatabaseSync } from "node:sqlite";

export interface BoardRecord {
  readonly threadId: string;
  readonly messageId: string;
  readonly hash: string;
}

/**
 * Forum posts Carlos keeps up to date from the sheets (the intel scoreboard), so a restart edits the post instead of
 * starting a new one. Apart from the guide posts, whose sync removes every key it does not know.
 */
export class BoardStore {
  constructor(private readonly db: DatabaseSync) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS board_posts (
        key        TEXT PRIMARY KEY,
        thread_id  TEXT NOT NULL,
        message_id TEXT NOT NULL,
        hash       TEXT NOT NULL
      ) STRICT;
    `);
  }

  get(key: string): BoardRecord | undefined {
    const row = this.db.prepare("SELECT thread_id, message_id, hash FROM board_posts WHERE key = ?").get(key) as
      | { thread_id: string; message_id: string; hash: string }
      | undefined;
    return row && { threadId: row.thread_id, messageId: row.message_id, hash: row.hash };
  }

  save(key: string, r: BoardRecord): void {
    this.db
      .prepare(
        `INSERT INTO board_posts (key, thread_id, message_id, hash) VALUES (?, ?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET thread_id = excluded.thread_id, message_id = excluded.message_id, hash = excluded.hash`,
      )
      .run(key, r.threadId, r.messageId, r.hash);
  }
}
