import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { memberHelp } from "../discord/help.js";
import { openMemoryDatabase } from "../storage/link-store.js";
import { GuideStore } from "../storage/guide-store.js";
import { fingerprint, guidePosts, MAX_MESSAGE, MAX_TITLE, pack, SCREENSHOT_KINDS, type GuideContext } from "./guide.js";
import { loadPictures } from "./pictures.js";

const url = "https://script.google.com/macros/s/x/exec";
const all: GuideContext = {
  sheets: { coachman: url, events: url, kvk: url, stats: url, members: url, siege: url },
  uploadChannelId: "111111111111111111",
  siegeChannelId: "222222222222222222",
};
const few: GuideContext = { sheets: { members: url }, uploadChannelId: "111111111111111111" };
const text = (ctx: GuideContext) => guidePosts(ctx).flatMap((p) => p.parts.map((x) => x.text)).join("\n");

describe("guide posts", () => {
  it("fit Discord's limits and have unique keys", () => {
    for (const ctx of [all, few]) {
      const posts = guidePosts(ctx);
      expect(new Set(posts.map((p) => p.key)).size).toBe(posts.length);
      for (const p of posts) {
        expect(p.title.length).toBeLessThanOrEqual(MAX_TITLE);
        expect(p.tags.length).toBeLessThanOrEqual(5);
        expect(p.parts.length).toBeGreaterThan(0);
        for (const part of p.parts) expect(part.text.length).toBeLessThanOrEqual(MAX_MESSAGE);
      }
    }
  });

  it("explain every member command Carlos offers, and none he does not", () => {
    for (const ctx of [all, few]) {
      const t = text(ctx);
      for (const e of memberHelp(ctx.sheets).filter((e) => e.name !== "help")) expect(t, `/${e.name}`).toContain(`**/${e.name}**`);
      expect(t).toContain("**/help**");
    }
    expect(text(few)).not.toContain("**/schedule**");
    expect(text(few)).not.toContain("Undead Siege");
  });

  it("show every screenshot kind with a place for its example pictures", () => {
    const parts = guidePosts(all).flatMap((p) => p.parts);
    for (const k of SCREENSHOT_KINDS) {
      const want = k.tabs ? k.tabs.map((_, i) => `${k.key}-${i + 1}`) : [k.key];
      expect(parts.filter((p) => p.image?.split("-")[0] === k.key).map((p) => p.image)).toEqual(want);
    }
  });

  it("never explain officer commands", () => {
    expect(text(all)).not.toContain("/lead");
  });

  it("use no emojis", () => {
    expect(text(all)).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("pack", () => {
  it("joins sections while they fit and never splits one", () => {
    expect(pack(["aaa", "bbb", "ccc"], 8)).toEqual(["aaa\n\nbbb", "ccc"]);
    expect(pack(["a".repeat(10)], 8)).toEqual(["a".repeat(10)]);
  });
});

describe("fingerprint and pictures", () => {
  it("changes with the text and with a picture", () => {
    const dir = mkdtempSync(join(tmpdir(), "guide-"));
    writeFileSync(join(dir, "squads.png"), "one");
    writeFileSync(join(dir, "battle-2.png"), "b2");
    writeFileSync(join(dir, "battle-1.jpg"), "b1");
    writeFileSync(join(dir, "README.md"), "not a picture");
    const pics = loadPictures(dir);
    expect(pics("battle").map((p) => p.name)).toEqual(["battle-1.jpg", "battle-2.png"]);
    expect(pics("scout")).toEqual([]);
    expect(pics("battle-2").map((p) => p.name)).toEqual(["battle-2.png"]);

    const post = guidePosts(all).find((p) => p.key === "shots-own")!;
    const before = fingerprint(post, pics);
    expect(fingerprint(post, pics)).toBe(before);
    writeFileSync(join(dir, "squads.png"), "two");
    expect(fingerprint(post, loadPictures(dir))).not.toBe(before);
    expect(fingerprint({ ...post, title: "Other" }, pics)).not.toBe(before);
  });

  it("treats a missing folder as no pictures", () => {
    expect(loadPictures(join(tmpdir(), "no-such-guide-folder"))("squads")).toEqual([]);
  });
});

describe("GuideStore", () => {
  it("remembers the thread and messages of each post", () => {
    const store = new GuideStore(openMemoryDatabase());
    expect(store.get("start")).toBeUndefined();
    store.save("start", { threadId: "1", messageIds: ["1", "2"], hash: "h" });
    store.save("start", { threadId: "1", messageIds: ["1", "2", "3"], hash: "h2" });
    expect(store.get("start")).toEqual({ threadId: "1", messageIds: ["1", "2", "3"], hash: "h2" });
    expect(store.keys()).toEqual(["start"]);
    store.remove("start");
    expect(store.keys()).toEqual([]);
  });
});
