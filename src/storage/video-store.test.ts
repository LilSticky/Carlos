import { describe, expect, it } from "vitest";
import { openMemoryDatabase } from "./link-store.js";
import { VideoStore } from "./video-store.js";

describe("VideoStore", () => {
  it("knows nothing about a new post", () => {
    expect(new VideoStore(openMemoryDatabase()).get("1")).toBeUndefined();
  });

  it("keeps the reply when a later state does not name one", () => {
    const store = new VideoStore(openMemoryDatabase());
    const at = new Date("2026-11-24T10:00:00Z");
    store.set("1", "asked", "ad,hunt", at, "99");
    store.set("1", "sending", "ad,hunt", at);
    expect(store.get("1")).toEqual({ postId: "1", replyId: "99", state: "sending", kinds: "ad,hunt" });
    store.set("1", "sent", "ad,hunt", at, null);
    expect(store.get("1")?.replyId).toBeNull();
  });
});
