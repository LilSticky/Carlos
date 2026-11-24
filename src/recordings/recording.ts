import { findMember } from "../members/members.js";
import { SheetError, type RecordingKind, type Sheet } from "../sheet/sheet.js";
import type { Attachment } from "../uploads/upload.js";

/** The recording page's limit (MAX_RECORDING_BYTES in upload/Code.js). */
export const MAX_VIDEO_BYTES = 400 * 1024 * 1024;

const VIDEO_TYPES: Readonly<Record<string, string>> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
};

/** The video type of an attachment from its content type, else from its file name; undefined when it is no video. */
export function videoType(a: Attachment): string | undefined {
  const type = a.contentType?.split(";")[0]?.trim().toLowerCase();
  if (type) return /^video\/[a-z0-9.+-]+$/.test(type) ? type : undefined;
  const ext = /\.([a-z0-9]+)$/i.exec(a.name)?.[1]?.toLowerCase();
  return ext ? VIDEO_TYPES[ext] : undefined;
}

/** The first video of a post Carlos can send, and how many other videos were left out (one recording per post). */
export function pickVideo(attachments: readonly Attachment[]): { video?: Attachment; mime?: string; others: number } {
  const videos = attachments.flatMap((a) => {
    const mime = videoType(a);
    return mime && a.size > 0 ? [{ video: a, mime }] : [];
  });
  const first = videos[0];
  return first ? { ...first, others: videos.length - 1 } : { others: 0 };
}

/**
 * The kind a post's text names, by its key or its label as whole words ("hunt", "Cheese Trap", "KvK score").
 * Undefined when it names none or more than one: then Carlos asks.
 */
export function kindFromText(text: string, kinds: readonly RecordingKind[]): RecordingKind | undefined {
  const words = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const named = kinds.filter((k) =>
    [k.key, k.label, k.label.split(" ")[0] ?? ""].some((w) => {
      const word = w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      return word.length >= 2 && words.includes(` ${word} `);
    }),
  );
  return named.length === 1 ? named[0] : undefined;
}

/** A short text that changes when the sheet offers other kinds: Carlos then asks again about posts it put off. */
export function kindsKey(kinds: readonly RecordingKind[]): string {
  return kinds.map((k) => k.key).sort().join(",");
}

export type RecordingOutcome =
  | { readonly kind: "not-linked" }
  | { readonly kind: "not-officer"; readonly member: string }
  | { readonly kind: "no-video" }
  | { readonly kind: "too-big"; readonly mb: number }
  | { readonly kind: "unreadable" }
  | { readonly kind: "sent"; readonly member: string; readonly label: string; readonly mb: number; readonly others: number }
  | { readonly kind: "failed"; readonly error: string; readonly setup: boolean };

export interface RecordingDeps {
  readonly memberOf: (discordId: string) => string | undefined;
  readonly officers: () => Promise<string[]>;
  readonly download: (attachment: Attachment) => Promise<Uint8Array>;
  readonly sheet: Pick<Sheet, "startRecording" | "sendPart">;
}

/** Who may send a recording: the member a Discord account is linked to, if R4 or R5. */
export async function officerOf(
  discordId: string,
  deps: Pick<RecordingDeps, "memberOf" | "officers">,
): Promise<{ ok: true; member: string } | { ok: false; outcome: RecordingOutcome }> {
  const linked = deps.memberOf(discordId);
  if (!linked) return { ok: false, outcome: { kind: "not-linked" } };
  let member: string | undefined;
  try {
    member = findMember(await deps.officers(), linked);
  } catch (e) {
    return { ok: false, outcome: failed(e) };
  }
  return member ? { ok: true, member } : { ok: false, outcome: { kind: "not-officer", member: linked } };
}

/**
 * The video of a post in the video channel goes into the Upload Inbox as a recording of `kind`, as if its poster
 * had used the recording page: the sheet opens the row, Carlos sends the parts in order. Alliance Members reads it
 * with the AI and fills the kind's import tab, where an officer checks and imports it.
 */
export async function sendRecording(
  post: { readonly authorId: string; readonly attachments: readonly Attachment[] },
  kind: RecordingKind,
  deps: RecordingDeps,
): Promise<RecordingOutcome> {
  const who = await officerOf(post.authorId, deps);
  if (!who.ok) return who.outcome;
  const { video, mime, others } = pickVideo(post.attachments);
  if (!video || !mime) return { kind: "no-video" };
  if (video.size > MAX_VIDEO_BYTES) return { kind: "too-big", mb: mb(video.size) };

  let bytes: Uint8Array;
  try {
    bytes = await deps.download(video);
  } catch {
    return { kind: "unreadable" };
  }
  try {
    const start = await deps.sheet.startRecording({ member: who.member, kind: kind.key, size: bytes.length, mime });
    for (let index = 0; index < start.parts; index++) {
      await deps.sheet.sendPart(start.id, index, bytes.subarray(index * start.partBytes, (index + 1) * start.partBytes));
    }
    return { kind: "sent", member: start.name, label: kind.label, mb: mb(bytes.length), others };
  } catch (e) {
    return failed(e);
  }
}

function mb(bytes: number): number {
  return Math.max(1, Math.round(bytes / 1048576));
}

function failed(e: unknown): RecordingOutcome {
  if (e instanceof SheetError) return { kind: "failed", error: e.message, setup: e.setup };
  return { kind: "failed", error: "Something went wrong. Please try again.", setup: true };
}
