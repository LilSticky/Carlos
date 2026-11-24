import type { DatabaseSync } from "node:sqlite";

/**
 * What Carlos did with each video posted in the video channel, so a restart neither sends a recording twice nor
 * forgets a question it asked.
 *   asked:   Carlos asked which ranking it is (the menu is in `replyId`)
 *   sending: the parts are on their way (a crash leaves it here: asked again on the next start)
 *   sent:    in the Upload Inbox
 *   later:   an officer said the sheet has no import for this event yet; asked again when the kinds change
 *   skipped: an officer said it needs no import (already imported, or not a ranking)
 */
export type VideoState = "asked" | "sending" | "sent" | "later" | "skipped";

export interface VideoPost {
  readonly postId: string;
  readonly replyId: string | null;
  readonly state: VideoState;
  /** kindsKey() of the kinds offered when this state was set. */
  readonly kinds: string;
}

export class VideoStore {
  constructor(private readonly db: DatabaseSync) {
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

  get(postId: string): VideoPost | undefined {
    const row = this.db.prepare("SELECT post_id, reply_id, state, kinds FROM video_posts WHERE post_id = ?").get(postId) as
      | { post_id: string; reply_id: string | null; state: VideoState; kinds: string }
      | undefined;
    return row ? { postId: row.post_id, replyId: row.reply_id, state: row.state, kinds: row.kinds } : undefined;
  }

  /** Sets the state; a reply ID of undefined keeps the one stored. */
  set(postId: string, state: VideoState, kinds: string, at: Date, replyId?: string | null): void {
    this.db
      .prepare(
        `INSERT INTO video_posts (post_id, reply_id, state, kinds, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (post_id) DO UPDATE SET
           reply_id = CASE WHEN ? THEN excluded.reply_id ELSE video_posts.reply_id END,
           state = excluded.state, kinds = excluded.kinds, updated_at = excluded.updated_at`,
      )
      .run(postId, replyId ?? null, state, kinds, at.toISOString(), replyId === undefined ? 0 : 1);
  }
}
