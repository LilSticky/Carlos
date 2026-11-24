import { describe, expect, it } from "vitest";
import { findMember, MemberList, suggestMembers } from "./members.js";

const names = ["Ánna Bell", "Bob", "Kibo", "Zed"];

describe("findMember", () => {
  it("matches ignoring case, accents and spaces", () => {
    expect(findMember(names, "annabell")).toBe("Ánna Bell");
    expect(findMember(names, " BOB ")).toBe("Bob");
  });

  it("does not guess from part of a name", () => {
    expect(findMember(names, "bo")).toBeUndefined();
    expect(findMember(names, "  ")).toBeUndefined();
  });
});

describe("suggestMembers", () => {
  it("puts names that start with the text before names that contain it", () => {
    expect(suggestMembers(names, "bo")).toEqual(["Bob", "Kibo"]);
  });

  it("offers the first names when nothing is typed, up to the limit", () => {
    expect(suggestMembers(names, "", 2)).toEqual(["Ánna Bell", "Bob"]);
  });
});

describe("MemberList", () => {
  it("asks the sheet again only when the list is old", async () => {
    let calls = 0, now = 0;
    const list = new MemberList({ members: async () => { calls++; return ["A"]; } }, () => now, 1000);
    expect(list.peek()).toEqual([]);
    await list.names();
    now = 999;
    await list.names();
    expect(calls).toBe(1);
    now = 1000;
    await list.names();
    expect(calls).toBe(2);
    await list.fresh();
    expect(calls).toBe(3);
    expect(list.peek()).toEqual(["A"]);
  });
});
