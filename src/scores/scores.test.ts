import { describe, expect, it } from "vitest";
import { BOARD_ROWS, points, readScores, scoreEmbeds, stampEmbeds } from "./scores.js";

const battle = (rank: number, member: string, pts: number, week = pts) => ({
  rank, member, points: pts, last7Days: week, base: pts, quests: 0, reports: 2, best: "X (10)", last: "2026-11-25 16:50", newFinds: 1,
});

const raw = {
  battle: [battle(1, "Alpha", 4219.5), battle(2, "Bravo", 818.4), battle(3, "Charlie", 472.5), battle(4, "Delta", 445.3, 100)],
  scouting: [{ rank: 1, member: "Alpha", points: 6120.4, last7Days: 6120.4, base: 6120.4, quests: 0, reports: 18, best: "", last: "", resources: 61_202_900_000 }],
  since: "",
  quests: [],
};

describe("readScores", () => {
  it("reads the sheet's answer", () => {
    expect(readScores(raw)?.battle).toHaveLength(4);
  });
  it("refuses an answer without boards", () => {
    expect(readScores({ quests: [] })).toBeUndefined();
  });
});

describe("scoreEmbeds", () => {
  const s = readScores(raw)!;
  const [b, sc, ...rest] = scoreEmbeds(s, "123");

  it("puts the top three on a podium and the rest below", () => {
    expect(b!.fields!.slice(0, 3).map((f) => f.name)).toEqual(["1st place", "2nd place", "3rd place"]);
    expect(b!.fields![0]!.value).toContain("**Alpha**\n4,219.5 pts");
    expect(b!.fields![3]!.value).toContain("**Delta** · 445.3 pts");
    expect(b!.fields![3]!.value).toContain("+100 this week");
  });
  it("shows the resources scouted", () => {
    expect(sc!.fields![0]!.value).toContain("61.2B found");
  });
  it("leaves out the quests when none run", () => {
    expect(rest).toHaveLength(0);
  });
  it("names the upload channel on an empty board", () => {
    const empty = scoreEmbeds({ ...s, scouting: [] }, "123")[1]!;
    expect(empty.fields).toBeUndefined();
    expect(empty.description).toContain("<#123>");
  });
  it("lists the running quests", () => {
    const q = { quest: "Next KvK opponent", board: "Battle", from: "", until: "2026-11-29", multiplier: 2, bonus: null, reports: 0, points: 0, leader: "" };
    const embeds = scoreEmbeds({ ...s, quests: [q] }, "123");
    expect(embeds[2]!.fields![0]!.value).toContain("points x2 · until 29.11.");
  });
  it("cuts a long board", () => {
    const many = Array.from({ length: BOARD_ROWS + 5 }, (_, i) => battle(i + 1, `M${i}`, 100 - i));
    const embed = scoreEmbeds({ ...s, battle: many }, "123")[0]!;
    expect(embed.fields![3]!.value).toContain("…and 5 more");
  });
  it("stamps only the last embed", () => {
    const stamped = stampEmbeds([b!, sc!], new Date("2026-11-26T10:00:00Z"));
    expect(stamped[0]!.timestamp).toBeUndefined();
    expect(stamped[1]!.timestamp).toBe("2026-11-26T10:00:00.000Z");
  });
});

describe("points", () => {
  it("groups thousands and keeps one decimal", () => {
    expect(points(4219.54)).toBe("4,219.5");
    expect(points(27)).toBe("27");
  });
});
