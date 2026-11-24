import { describe, expect, it } from "vitest";
import { LinkStore, openMemoryDatabase } from "./link-store.js";

const at = new Date("2026-11-24T10:00:00Z");

describe("LinkStore", () => {
  it("remembers which member a Discord account is, and moves it on a new link", () => {
    const links = new LinkStore(openMemoryDatabase());
    expect(links.memberOf("1")).toBeUndefined();
    links.link("1", "Alpha", at);
    expect(links.memberOf("1")).toBe("Alpha");
    links.link("1", "Bravo", at);
    expect(links.memberOf("1")).toBe("Bravo");
  });

  it("finds another account that holds a member name, in any case", () => {
    const links = new LinkStore(openMemoryDatabase());
    links.link("1", "Alpha", at);
    expect(links.holderOf("alpha", "2")).toBe("1");
    expect(links.holderOf("Alpha", "1")).toBeUndefined();
  });

  it("frees a member name", () => {
    const links = new LinkStore(openMemoryDatabase());
    links.link("1", "Alpha", at);
    links.release("ALPHA");
    expect(links.memberOf("1")).toBeUndefined();
  });
});
