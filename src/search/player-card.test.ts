import { describe, expect, it } from "vitest";
import { readPlayers, searchAnswer } from "./player-card.js";

const alpha = {
  name: "Alpha",
  status: "Member (guard)",
  joined: "01.10.2026",
  notes: "officer remark",
  squadTop: "120,000,000 (checked 20.11.2026)",
  lastAssigned: "Mon 16.11.2026 as coachman",
  queue: "Coachman queue 3 of 40",
  thisWeek: ["Wed 25.11.: Guard"],
  log: [{ date: "Mon 16.11.2026", role: "Coachman", result: "Assigned", reason: "", special: false }],
  scores: [{ week: "16.11.2026", days: ["500,000", "300,000", "", "600,000", "700,000", "800,000"], weekly: "2,900,000", target: false, note: "" }],
  donations: [{ week: "16.11.2026", amount: "12,000", target: true, note: "" }],
  min: 400000,
  minDonation: "10,000",
  donationCheck: true,
  squads: {
    date: "20.11.2026", age: 4, old: false, imports: 2, total: "150,000,000",
    list: [{ squad: "Squad 1", might: "50,000,000", heroes: [{ pos: 1, hero: "Hero A", level: 60, stars: 5 }] }],
  },
};

describe("player search", () => {
  it("reads the sheet's answer, numbers and all", () => {
    expect(readPlayers([alpha])?.[0]?.squads?.list[0]?.heroes[0]).toEqual({ hero: "Hero A", level: "60", stars: "5" });
    expect(readPlayers({ nope: 1 })).toBeUndefined();
  });

  it("shows the best match in full and names the others", () => {
    const players = readPlayers([alpha, { ...alpha, name: "Alphonse", status: "Former member" }])!;
    const text = searchAnswer(players, "alph", false);
    expect(text).toContain("## Alpha\n*Member (guard)*");
    expect(text).toContain("Top 3 squads: 120,000,000 (checked 20.11.2026)");
    expect(text).toContain("- Squad 1: 50,000,000 · Hero A 60/5★");
    expect(text).toContain("- Week of 16.11.2026: I 500,000 · II 300,000 ⚠ · III - ⚠ · IV 600,000");
    expect(text).toContain("weekly 2,900,000 ❌");
    expect(text).toContain("- Week of 16.11.2026: 12,000 ✅");
    expect(text).toContain("- Mon 16.11.2026: Coachman, Assigned");
    expect(text).toMatch(/Also found: Alphonse$/);
  });

  it("shows the officers' notes only to officers", () => {
    const players = readPlayers([alpha])!;
    expect(searchAnswer(players, "alpha", false)).not.toContain("officer remark");
    expect(searchAnswer(players, "alpha", true)).toContain("Notes: officer remark");
  });

  it("says when nobody is found", () => {
    expect(searchAnswer([], "zz", false)).toBe("No player found for **zz**.");
  });
});
