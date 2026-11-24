import { describe, expect, it } from "vitest";
import { canRetryUpload, uploadText } from "./texts.js";

describe("canRetryUpload", () => {
  it("offers Retry only where a second try can work", () => {
    expect(canRetryUpload({ kind: "not-linked" })).toBe(true);
    expect(canRetryUpload({ kind: "not-a-member", member: "Alpha" })).toBe(true);
    expect(canRetryUpload({ kind: "failed", error: "Busy.", setup: false, sent: 0, count: 2 })).toBe(true);
    expect(canRetryUpload({ kind: "unreadable", index: 0 })).toBe(false);
    expect(canRetryUpload({ kind: "no-pictures" })).toBe(false);
    expect(canRetryUpload({ kind: "sent", member: "Alpha", count: 1, skipped: 0 })).toBe(false);
  });
});

describe("uploadText", () => {
  it("says to press Retry when the reply has the button", () => {
    expect(uploadText({ kind: "not-linked" }, true)).toBe("Who are you in the game? Tell me once with **/iam**, then press **Retry**.");
    expect(uploadText({ kind: "not-a-member", member: "Alpha" }, true)).toContain("Then press **Retry**.");
    expect(uploadText({ kind: "failed", error: "Busy.", setup: false, sent: 0, count: 2 }, true)).toBe("Busy. Press **Retry** to send them again.");
    expect(uploadText({ kind: "failed", error: "Busy.", setup: false, sent: 1, count: 3 }, true)).toContain(
      "Only 1 of 3 pictures arrived: press **Retry** later",
    );
  });

  it("says to send again without the button (/whisper)", () => {
    expect(uploadText({ kind: "not-linked" })).toContain("then send your screenshots again.");
    expect(uploadText({ kind: "failed", error: "Busy.", setup: false, sent: 0, count: 2 })).toBe("Busy.");
  });
});
