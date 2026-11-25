import { describe, expect, it } from "vitest";
import {
  allianceEmbed,
  ambiguousText,
  matchOptions,
  playerArgs,
  playerEmbed,
  playerNotFoundText,
  plain,
  readAllianceAnswer,
  readPlayerAnswer,
  rosterOptions,
  rosterText,
  type RosterMember,
} from "./tracker.js";

const player = {
  uid: "12345678",
  name: "Sam_the*Great",
  kingdom: "101",
  might: 123456789,
  level: 25,
  kills: 4500000,
  vip: 12,
  likes: 300,
  language: "de",
  x: 749,
  y: 920,
  alliance: { tag: "ABC", name: "Alpha Bravo", members: 98 },
  rank: "R4",
  picture: "https://lastasylumtracker.com/static/a.png",
  mapUpdated: "2026-11-24 18:00",
  lastSeen: "2026-11-24 18:00",
  quota: { remaining: 812, limit: 1000 },
};

const member = (name: string, rank: string, might: number, uid = name): RosterMember => ({ uid, name, rank, might, level: 20, online: false, lastOnline: null });

const alliance = {
  id: "77",
  tag: "ABC",
  name: "Alpha Bravo",
  kingdom: "101",
  might: 9_000_000_000,
  level: 8,
  members: 3,
  capacity: 100,
  leader: "Boss",
  mightRank: 2,
  picture: null,
  roster: [member("Boss", "R5", 300e6), member("Ann", "R4", 200e6), member("Bo", "R1", 5e6)],
  quota: { remaining: 811, limit: 1000 },
};

describe("reading the sheet's answers", () => {
  it("reads a found player, a pick list and nothing found", () => {
    expect(readPlayerAnswer({ kind: "found", player })?.kind).toBe("found");
    expect(readPlayerAnswer({ kind: "ambiguous", matches: [{ uid: "1", kingdom: "101", name: "Sam" }] })?.kind).toBe("ambiguous");
    expect(readPlayerAnswer({ kind: "not-found" })?.kind).toBe("not-found");
    expect(readPlayerAnswer({ kind: "found", player: { name: "Sam" } })).toBeUndefined();
    expect(readPlayerAnswer(null)).toBeUndefined();
  });

  it("reads an alliance and nothing found", () => {
    expect(readAllianceAnswer({ kind: "found", alliance })?.kind).toBe("found");
    expect(readAllianceAnswer({ kind: "not-found", kingdom: "330" })).toEqual({ kind: "not-found", kingdom: "330" });
    expect(readAllianceAnswer({ kind: "found" })).toBeUndefined();
  });
});

describe("playerArgs", () => {
  it("prefers the uid, keeps only its digits", () => {
    expect(playerArgs({ uid: " 123 456 ", name: "Sam" })).toEqual({ uid: "123456" });
  });

  it("takes a name, with the Kingdom when given", () => {
    expect(playerArgs({ name: " Sam " })).toEqual({ name: "Sam" });
    expect(playerArgs({ name: "Sam", kingdom: 101 })).toEqual({ name: "Sam", kingdom: "101" });
  });

  it("gives nothing without a usable uid or name", () => {
    expect(playerArgs({ uid: "abc", name: "  " })).toBeUndefined();
    expect(playerArgs({ kingdom: 101 })).toBeUndefined();
  });
});

describe("cards", () => {
  it("shows the player with alliance, rank, place and when the map was read", () => {
    const e = playerEmbed(player);
    expect(e.title).toBe("Sam\\_the\\*Great");
    expect(e.author?.name).toBe("Kingdom #101");
    const fields = Object.fromEntries((e.fields ?? []).map((f) => [f.name, f.value]));
    expect(fields).toMatchObject({
      Might: "123,456,789",
      "Sanctuary level": "25",
      Language: "German",
      Alliance: "[ABC] Alpha Bravo",
      "Alliance Rank": "R4",
      Location: "X:749 Y:920",
      uid: "12345678",
    });
    expect(e.thumbnail?.url).toBe(player.picture);
    expect(e.footer?.text).toBe("Last Asylum Tracker · map read 2026-11-24 18:00 server time · 812 requests left today");
  });

  it("shows a player without an alliance, and leaves out what is unknown", () => {
    const e = playerEmbed({ ...player, alliance: null, rank: "", kills: null, x: null, picture: null, mapUpdated: null, quota: null });
    const names = (e.fields ?? []).map((f) => f.name);
    expect(names).not.toContain("Alliance Rank");
    expect(names).not.toContain("Kills");
    expect(names).not.toContain("Location");
    expect(e.fields?.find((f) => f.name === "Alliance")?.value).toBe("No alliance");
    expect(e.thumbnail).toBeUndefined();
    expect(e.footer?.text).toBe("Last Asylum Tracker");
  });

  it("shows the alliance with its roster by rank", () => {
    const e = allianceEmbed(alliance);
    expect(e.title).toBe("[ABC] Alpha Bravo");
    expect(e.description).toBe("**R5**\nBoss · 300M\n\n**R4**\nAnn · 200M\n\n**R1**\nBo · 5M");
    expect(e.fields?.find((f) => f.name === "Members")?.value).toBe("3/100");
    expect(e.footer?.text).toBe("Last Asylum Tracker · 811 requests left today");
  });

  it("cuts a long roster and counts the rest", () => {
    const roster = Array.from({ length: 100 }, (_, i) => member(`Player number ${i}`, "R1", 1e6));
    const t = rosterText(roster, 500);
    expect(t.length).toBeLessThanOrEqual(500);
    expect(t).toMatch(/…and \d+ more\.$/);
  });

  it("escapes Discord markdown in names", () => {
    expect(plain("a_b*c~d`e|f>g[h](i)")).toBe("a\\_b\\*c\\~d\\`e\\|f\\>g\\[h\\]\\(i\\)");
  });
});

describe("menus and texts", () => {
  it("offers the roster by uid, at most 25", () => {
    expect(rosterOptions(alliance)[0]).toEqual({ label: "Boss", value: "Boss", description: "R5 · Might 300M" });
    const big = { ...alliance, roster: Array.from({ length: 40 }, (_, i) => member(`P${i}`, "R1", 1, String(i))) };
    expect(rosterOptions(big)).toHaveLength(25);
    expect(rosterOptions({ ...alliance, roster: [member("NoUid", "R1", 1, "")] })).toEqual([]);
  });

  it("offers each player who shares the name, with their Kingdom", () => {
    const matches = [{ uid: "1", kingdom: "101", name: "Sam" }, { uid: "2", kingdom: "", name: "Sam" }];
    expect(matchOptions(matches)).toEqual([
      { label: "Sam", value: "1", description: "Kingdom #101 · uid 1" },
      { label: "Sam", value: "2", description: "uid 2" },
    ]);
    expect(ambiguousText("Sam", matches)).toBe("2 players are called **Sam**. Pick the one you mean.");
  });

  it("says what was not found", () => {
    expect(playerNotFoundText({ uid: "9" })).toBe("The tracker knows no player with uid **9**.");
    expect(playerNotFoundText({ name: "Sam", kingdom: "101" })).toContain("called **Sam** in Kingdom #101");
  });
});
