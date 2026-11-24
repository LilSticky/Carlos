import { describe, expect, it } from "vitest";
import { SheetError, type PictureToSend } from "../sheet/sheet.js";
import { pickPictures, sendUpload, type Attachment, type UploadDeps } from "./upload.js";

const png = (name: string): Attachment => ({ url: `https://cdn/${name}`, name, contentType: "image/png", size: 5000 });

function deps(over: Partial<UploadDeps> = {}) {
  const sent: PictureToSend[] = [];
  const d: UploadDeps = {
    memberOf: (id) => (id === "42" ? "alpha" : undefined),
    members: async () => ["Alpha", "Bravo"],
    download: async (a) => new TextEncoder().encode(a.name),
    toJpeg: async (b) => b,
    sheet: {
      sendPicture: async (p) => {
        sent.push(p);
        return "Alpha";
      },
    },
    ...over,
  };
  return { d, sent };
}

const message = (attachments: Attachment[], authorId = "42") => ({ authorId, messageId: "1234567890", attachments });

describe("pickPictures", () => {
  it("keeps pictures, leaves out other files, and stops at 10", () => {
    const files = [png("a.png"), { ...png("b.txt"), contentType: "text/plain" }, { ...png("c.JPG"), contentType: null }];
    expect(pickPictures(files)).toEqual({ pictures: [files[0], files[2]], skipped: 1 });
    const many = Array.from({ length: 12 }, (_, i) => png(`${i}.png`));
    expect(pickPictures(many).pictures).toHaveLength(10);
    expect(pickPictures(many).skipped).toBe(2);
  });

  it("leaves out empty and huge files", () => {
    expect(pickPictures([{ ...png("a.png"), size: 0 }, { ...png("b.png"), size: 26 * 1024 * 1024 }]).pictures).toEqual([]);
  });
});

describe("sendUpload", () => {
  it("sends every picture in order as one upload, under the member's name from the sheet", async () => {
    const { d, sent } = deps();
    const outcome = await sendUpload(message([png("1.png"), png("2.png")]), d);
    expect(outcome).toEqual({ kind: "sent", member: "Alpha", count: 2, skipped: 0 });
    expect(sent.map((p) => [p.member, p.uploadId, p.index, p.count])).toEqual([
      ["Alpha", "dc-1234567890", 0, 2],
      ["Alpha", "dc-1234567890", 1, 2],
    ]);
  });

  it("asks a member who has not said who they are to use /iam", async () => {
    const { d, sent } = deps();
    expect(await sendUpload(message([png("1.png")], "7"), d)).toEqual({ kind: "not-linked" });
    expect(sent).toEqual([]);
  });

  it("notices a linked member who is no longer on the member list", async () => {
    const { d } = deps({ members: async () => ["Bravo"] });
    expect(await sendUpload(message([png("1.png")]), d)).toEqual({ kind: "not-a-member", member: "alpha" });
  });

  it("does nothing without pictures", async () => {
    const { d } = deps();
    expect(await sendUpload(message([{ ...png("a.txt"), contentType: "text/plain" }]), d)).toEqual({ kind: "no-pictures" });
  });

  it("sends nothing when one picture cannot be read", async () => {
    const { d, sent } = deps({
      toJpeg: async (b) => {
        if (new TextDecoder().decode(b) === "2.png") throw new Error("bad");
        return b;
      },
    });
    expect(await sendUpload(message([png("1.png"), png("2.png")]), d)).toEqual({ kind: "unreadable", index: 1 });
    expect(sent).toEqual([]);
  });

  it("stops at the first picture the sheet refuses and says how far it got", async () => {
    let n = 0;
    const { d } = deps({
      sheet: {
        sendPicture: async () => {
          if (++n === 2) throw new SheetError("Many uploads right now. Please try again in an hour.");
          return "Alpha";
        },
      },
    });
    expect(await sendUpload(message([png("1.png"), png("2.png"), png("3.png")]), d)).toEqual({
      kind: "failed",
      error: "Many uploads right now. Please try again in an hour.",
      setup: false,
      sent: 1,
      count: 3,
    });
    expect(n).toBe(2);
  });

  it("reports a sheet it cannot reach for the member list", async () => {
    const { d } = deps({ members: async () => { throw new SheetError("not connected", true); } });
    expect(await sendUpload(message([png("1.png")]), d)).toEqual({ kind: "failed", error: "not connected", setup: true, sent: 0, count: 1 });
  });
});
