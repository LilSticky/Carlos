import { describe, expect, it } from "vitest";
import { openMemoryDatabase } from "./link-store.js";
import { KvkStore } from "./kvk-store.js";

describe("KvkStore", () => {
  it("remembers the vote card and the readiness card of a battle", () => {
    const store = new KvkStore(openMemoryDatabase());
    expect(store.posts("2026-11-28")).toEqual({ channelId: null, inviteMessageId: null, readinessPosted: false });
    store.invited("2026-11-28", "111", "222");
    store.readinessPosted("2026-11-28", "111", new Date());
    expect(store.posts("2026-11-28")).toEqual({ channelId: "111", inviteMessageId: "222", readinessPosted: true });
    expect(store.posts("2026-12-05").readinessPosted).toBe(false);
  });
});
