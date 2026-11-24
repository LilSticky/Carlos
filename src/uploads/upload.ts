import type { Sheet } from "../sheet/sheet.js";
import { SheetError } from "../sheet/sheet.js";
import { findMember } from "../members/members.js";

/** As many as the upload page takes at once; also Discord's limit per message. */
export const MAX_PICTURES = 10;
/** Bigger files are no screenshots. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const PICTURE_TYPES = /^image\/(png|jpe?g|webp|gif|avif|tiff)$/i;
const PICTURE_NAMES = /\.(png|jpe?g|webp|gif|avif|tiff?)$/i;

export interface Attachment {
  readonly url: string;
  readonly name: string;
  readonly contentType: string | null;
  readonly size: number;
}

/** The attachments that are pictures Carlos can read, and how many others were left out. */
export function pickPictures(attachments: readonly Attachment[]): { pictures: Attachment[]; skipped: number } {
  const pictures = attachments.filter(
    (a) =>
      a.size > 0 &&
      a.size <= MAX_FILE_BYTES &&
      (a.contentType ? PICTURE_TYPES.test(a.contentType) : PICTURE_NAMES.test(a.name)),
  );
  return { pictures: pictures.slice(0, MAX_PICTURES), skipped: attachments.length - Math.min(pictures.length, MAX_PICTURES) };
}

export type UploadOutcome =
  | { readonly kind: "not-linked" }
  | { readonly kind: "not-a-member"; readonly member: string }
  | { readonly kind: "no-pictures" }
  | { readonly kind: "unreadable"; readonly index: number }
  | { readonly kind: "sent"; readonly member: string; readonly count: number; readonly skipped: number }
  | { readonly kind: "failed"; readonly error: string; readonly setup: boolean; readonly sent: number; readonly count: number };

export interface UploadDeps {
  readonly memberOf: (discordId: string) => string | undefined;
  readonly members: () => Promise<string[]>;
  readonly download: (attachment: Attachment) => Promise<Uint8Array>;
  readonly toJpeg: (bytes: Uint8Array) => Promise<Uint8Array>;
  readonly sheet: Pick<Sheet, "sendPicture">;
}

/**
 * One Discord message with screenshots becomes one upload in the Upload Inbox, as if the member had used the
 * upload page. Every picture is read before the first is sent, so a broken file never leaves a half upload.
 * Nothing is sent twice: a picture the sheet did not take ends the upload, and the officers reject the row.
 */
export async function sendUpload(
  message: { readonly authorId: string; readonly messageId: string; readonly attachments: readonly Attachment[] },
  deps: UploadDeps,
): Promise<UploadOutcome> {
  const linked = deps.memberOf(message.authorId);
  if (!linked) return { kind: "not-linked" };
  const { pictures, skipped } = pickPictures(message.attachments);
  if (!pictures.length) return { kind: "no-pictures" };

  let member: string | undefined;
  try {
    member = findMember(await deps.members(), linked);
  } catch (e) {
    return failed(e, 0, pictures.length);
  }
  if (!member) return { kind: "not-a-member", member: linked };

  const jpegs: Uint8Array[] = [];
  for (const [index, picture] of pictures.entries()) {
    try {
      jpegs.push(await deps.toJpeg(await deps.download(picture)));
    } catch {
      return { kind: "unreadable", index };
    }
  }

  const uploadId = `dc-${message.messageId}`;
  let sent = 0;
  try {
    for (const [index, jpeg] of jpegs.entries()) {
      member = await deps.sheet.sendPicture({ member, uploadId, index, count: jpegs.length, jpeg });
      sent++;
    }
  } catch (e) {
    return failed(e, sent, jpegs.length);
  }
  return { kind: "sent", member, count: jpegs.length, skipped };
}

function failed(e: unknown, sent: number, count: number): UploadOutcome {
  if (e instanceof SheetError) return { kind: "failed", error: e.message, setup: e.setup, sent, count };
  return { kind: "failed", error: "Something went wrong. Please try again.", setup: true, sent, count };
}
