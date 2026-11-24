import { describe, expect, it } from "vitest";
import { openMemoryDatabase } from "./link-store.js";
import { SiegeStore } from "./siege-store.js";

describe("SiegeStore", () => {
  it("remembers the invitation and the plan of a siege", () => {
    const store = new SiegeStore(openMemoryDatabase());
    expect(store.posts("2026-11-26 20:00")).toEqual({ channelId: null, inviteMessageId: null, planPosted: false });
    store.invited("2026-11-26 20:00", "111", "222");
    store.planned("2026-11-26 20:00", "111", new Date());
    expect(store.posts("2026-11-26 20:00")).toEqual({ channelId: "111", inviteMessageId: "222", planPosted: true });
    expect(store.posts("2026-11-28 20:00").planPosted).toBe(false);
  });
});
