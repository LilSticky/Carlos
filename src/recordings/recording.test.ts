import { describe, expect, it } from "vitest";
import { SheetError, type RecordingKind, type RecordingToSend } from "../sheet/sheet.js";
import type { Attachment } from "../uploads/upload.js";
import { kindFromText, kindsKey, pickVideo, sendRecording, videoType, type RecordingDeps } from "./recording.js";

const KINDS: RecordingKind[] = [
  { key: "ad", label: "AD scores" },
  { key: "kvk", label: "KvK score" },
  { key: "hunt", label: "Hunt Battle" },
  { key: "cheese", label: "Cheese Trap" },
];
const HUNT = KINDS[2]!;

const mp4 = (name: string, size = 20_000_000): Attachment => ({ url: `https://cdn/${name}`, name, contentType: "video/mp4", size });

describe("videoType", () => {
  it("takes the content type, else the file name", () => {
    expect(videoType(mp4("a.mp4"))).toBe("video/mp4");
    expect(videoType({ ...mp4("a.MOV"), contentType: null })).toBe("video/quicktime");
    expect(videoType({ ...mp4("a.png"), contentType: "image/png" })).toBeUndefined();
    expect(videoType({ ...mp4("a.txt"), contentType: null })).toBeUndefined();
  });
});

describe("pickVideo", () => {
  it("takes the first video and counts the others", () => {
    const files = [{ ...mp4("a.png"), contentType: "image/png" }, mp4("b.mp4"), mp4("c.mp4")];
    expect(pickVideo(files)).toEqual({ video: files[1], mime: "video/mp4", others: 1 });
    expect(pickVideo([])).toEqual({ others: 0 });
  });
});

describe("kindFromText", () => {
  it("finds a kind named by key or label", () => {
    expect(kindFromText("hunt from today", KINDS)?.key).toBe("hunt");
    expect(kindFromText("Cheese Trap 2, level 7", KINDS)?.key).toBe("cheese");
    expect(kindFromText("AD week 47", KINDS)?.key).toBe("ad");
    expect(kindFromText("KvK", KINDS)?.key).toBe("kvk");
  });

  it("asks when the text names none or several", () => {
    expect(kindFromText("", KINDS)).toBeUndefined();
    expect(kindFromText("here you go", KINDS)).toBeUndefined();
    expect(kindFromText("hunt and cheese", KINDS)).toBeUndefined();
    expect(kindFromText("headache", KINDS)).toBeUndefined(); // "ad" only as a word
  });
});

describe("kindsKey", () => {
  it("does not depend on the order", () => {
    expect(kindsKey([KINDS[1]!, KINDS[0]!])).toBe("ad,kvk");
  });
});

function deps(over: Partial<RecordingDeps> = {}) {
  const started: RecordingToSend[] = [];
  const parts: { id: string; index: number; length: number }[] = [];
  const d: RecordingDeps = {
    memberOf: (id) => (id === "42" ? "alpha" : id === "43" ? "Bravo" : undefined),
    officers: async () => ["Alpha"],
    download: async (a) => new Uint8Array(a.size),
    sheet: {
      startRecording: async (r) => {
        started.push(r);
        return { id: "rec-1", parts: Math.ceil(r.size / 8), partBytes: 8, name: "Alpha" };
      },
      sendPart: async (id, index, bytes) => {
        parts.push({ id, index, length: bytes.length });
      },
    },
    ...over,
  };
  return { d, started, parts };
}

describe("sendRecording", () => {
  it("sends the video in parts as the poster's recording", async () => {
    const { d, started, parts } = deps();
    const outcome = await sendRecording({ authorId: "42", attachments: [mp4("a.mp4", 20)] }, HUNT, d);
    expect(outcome).toEqual({ kind: "sent", member: "Alpha", label: "Hunt Battle", mb: 1, others: 0 });
    expect(started).toEqual([{ member: "Alpha", kind: "hunt", size: 20, mime: "video/mp4" }]);
    expect(parts).toEqual([
      { id: "rec-1", index: 0, length: 8 },
      { id: "rec-1", index: 1, length: 8 },
      { id: "rec-1", index: 2, length: 4 },
    ]);
  });

  it("takes recordings from R4 and R5 only", async () => {
    const { d, started } = deps();
    expect(await sendRecording({ authorId: "7", attachments: [mp4("a.mp4")] }, HUNT, d)).toEqual({ kind: "not-linked" });
    expect(await sendRecording({ authorId: "43", attachments: [mp4("a.mp4")] }, HUNT, d)).toEqual({ kind: "not-officer", member: "Bravo" });
    expect(started).toEqual([]);
  });

  it("refuses a post without a video and one that is too big", async () => {
    const { d } = deps();
    expect(await sendRecording({ authorId: "42", attachments: [] }, HUNT, d)).toEqual({ kind: "no-video" });
    expect(await sendRecording({ authorId: "42", attachments: [mp4("a.mp4", 500 * 1048576)] }, HUNT, d)).toEqual({ kind: "too-big", mb: 500 });
  });

  it("says when the video cannot be downloaded", async () => {
    const { d } = deps({ download: async () => Promise.reject(new Error("HTTP 404")) });
    expect(await sendRecording({ authorId: "42", attachments: [mp4("a.mp4")] }, HUNT, d)).toEqual({ kind: "unreadable" });
  });

  it("passes the sheet's own refusal on", async () => {
    const { d } = deps();
    const refusing: RecordingDeps = {
      ...d,
      sheet: { ...d.sheet, startRecording: async () => Promise.reject(new SheetError("Many recordings today. Try again tomorrow.")) },
    };
    expect(await sendRecording({ authorId: "42", attachments: [mp4("a.mp4")] }, HUNT, refusing)).toEqual({
      kind: "failed",
      error: "Many recordings today. Try again tomorrow.",
      setup: false,
    });
  });
});
