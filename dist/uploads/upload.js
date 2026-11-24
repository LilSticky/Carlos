import { SheetError } from "../sheet/sheet.js";
import { findMember } from "../members/members.js";
/** As many as the upload page takes at once; also Discord's limit per message. */
export const MAX_PICTURES = 10;
/** Bigger files are no screenshots. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const PICTURE_TYPES = /^image\/(png|jpe?g|webp|gif|avif|tiff)$/i;
const PICTURE_NAMES = /\.(png|jpe?g|webp|gif|avif|tiff?)$/i;
/** The attachments that are pictures Carlos can read, and how many others were left out. */
export function pickPictures(attachments) {
    const pictures = attachments.filter((a) => a.size > 0 &&
        a.size <= MAX_FILE_BYTES &&
        (a.contentType ? PICTURE_TYPES.test(a.contentType) : PICTURE_NAMES.test(a.name)));
    return { pictures: pictures.slice(0, MAX_PICTURES), skipped: attachments.length - Math.min(pictures.length, MAX_PICTURES) };
}
/**
 * One Discord message with screenshots becomes one upload in the Upload Inbox, as if the member had used the
 * upload page. Every picture is read before the first is sent, so a broken file never leaves a half upload.
 * Nothing is sent twice: a picture the sheet did not take ends the upload, and the officers reject the row.
 */
export async function sendUpload(message, deps) {
    const linked = deps.memberOf(message.authorId);
    if (!linked)
        return { kind: "not-linked" };
    const { pictures, skipped } = pickPictures(message.attachments);
    if (!pictures.length)
        return { kind: "no-pictures" };
    let member;
    try {
        member = findMember(await deps.members(), linked);
    }
    catch (e) {
        return failed(e, 0, pictures.length);
    }
    if (!member)
        return { kind: "not-a-member", member: linked };
    const jpegs = [];
    for (const [index, picture] of pictures.entries()) {
        try {
            jpegs.push(await deps.toJpeg(await deps.download(picture)));
        }
        catch {
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
    }
    catch (e) {
        return failed(e, sent, jpegs.length);
    }
    return { kind: "sent", member, count: jpegs.length, skipped };
}
function failed(e, sent, count) {
    if (e instanceof SheetError)
        return { kind: "failed", error: e.message, setup: e.setup, sent, count };
    return { kind: "failed", error: "Something went wrong. Please try again.", setup: true, sent, count };
}
//# sourceMappingURL=upload.js.map