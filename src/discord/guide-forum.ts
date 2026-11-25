import { AttachmentBuilder, ChannelType, type AnyThreadChannel, type Client, type ForumChannel, type Message } from "discord.js";
import { fingerprint, type GuidePost } from "../guide/guide.js";
import type { Picture } from "../guide/pictures.js";
import type { GuideStore } from "../storage/guide-store.js";

export interface GuideDeps {
  readonly forumId: string;
  readonly posts: readonly GuidePost[];
  readonly pictures: (image: string) => readonly Picture[];
  readonly store: GuideStore;
  readonly log: (line: string) => void;
}

const NO_PINGS = { parse: [] as never[] };

function body(post: GuidePost, i: number, pictures: GuideDeps["pictures"]) {
  const part = post.parts[i]!;
  const files = (part.image ? pictures(part.image) : []).map((p) => new AttachmentBuilder(Buffer.from(p.bytes), { name: p.name }));
  return { content: part.text, files, allowedMentions: NO_PINGS };
}

function tagIds(forum: ForumChannel, names: readonly string[]): string[] {
  const wanted = names.map((n) => n.toLowerCase());
  return forum.availableTags.filter((t) => wanted.includes(t.name.toLowerCase())).map((t) => t.id).slice(0, 5);
}

async function findThread(client: Client, id: string): Promise<AnyThreadChannel | null> {
  try {
    const ch = await client.channels.fetch(id);
    return ch?.isThread() ? ch : null;
  } catch {
    return null;
  }
}

/**
 * Brings the guide forum in step with the posts: creates the missing ones, edits those whose text or pictures
 * changed, deletes the threads of topics that are gone. Runs on every start, so a new version of Carlos updates the
 * forum by itself. Posts that did not change are not touched.
 */
export async function syncGuide(client: Client, d: GuideDeps): Promise<void> {
  const forum = await client.channels.fetch(d.forumId);
  if (forum?.type !== ChannelType.GuildForum) {
    d.log(`Guide: channel ${d.forumId} is not a forum channel.`);
    return;
  }
  // the forum shows the newest post first: create in reverse, so "Start here" ends up on top
  for (const post of [...d.posts].reverse()) {
    try {
      await syncPost(client, forum, post, d);
    } catch (e) {
      d.log(`Guide "${post.key}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const current = new Set(d.posts.map((p) => p.key));
  for (const key of d.store.keys().filter((k) => !current.has(k))) {
    const thread = await findThread(client, d.store.get(key)!.threadId);
    await thread?.delete("This guide topic is gone").catch((e: unknown) => d.log(`Guide "${key}": not deleted (${String(e)}).`));
    d.store.remove(key);
    d.log(`Guide "${key}": removed.`);
  }
}

async function syncPost(client: Client, forum: ForumChannel, post: GuidePost, d: GuideDeps): Promise<void> {
  const hash = fingerprint(post, d.pictures);
  const saved = d.store.get(post.key);
  const thread = saved ? await findThread(client, saved.threadId) : null;
  if (saved && thread && saved.hash === hash) return;

  if (!saved || !thread) {
    const created = await forum.threads.create({
      name: post.title,
      message: body(post, 0, d.pictures),
      appliedTags: tagIds(forum, post.tags),
    });
    const ids = [created.id]; // the starter message has the thread's ID
    for (let i = 1; i < post.parts.length; i++) ids.push((await created.send(body(post, i, d.pictures))).id);
    d.store.save(post.key, { threadId: created.id, messageIds: ids, hash });
    if (post.key === "start") await created.pin().catch(() => undefined);
    d.log(`Guide "${post.key}": posted.`);
    return;
  }

  if (thread.archived) await thread.setArchived(false);
  if (thread.name !== post.title) await thread.setName(post.title);
  const tags = tagIds(forum, post.tags);
  if (tags.join() !== thread.appliedTags.join()) await thread.setAppliedTags(tags);
  const ids: string[] = [];
  for (let i = 0; i < post.parts.length; i++) {
    const id = saved.messageIds[i];
    const msg: Message | null = id ? await thread.messages.fetch(id).catch(() => null) : null;
    if (msg) {
      await msg.edit({ ...body(post, i, d.pictures), attachments: [] });
      ids.push(msg.id);
    } else {
      ids.push((await thread.send(body(post, i, d.pictures))).id);
    }
  }
  for (const id of saved.messageIds.slice(post.parts.length)) {
    if (id !== thread.id) await thread.messages.delete(id).catch(() => undefined);
  }
  d.store.save(post.key, { threadId: thread.id, messageIds: ids, hash });
  d.log(`Guide "${post.key}": updated.`);
}
