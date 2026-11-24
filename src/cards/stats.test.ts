import { describe, expect, it } from "vitest";
import { readStats, statsEmbeds } from "./stats.js";

const answer = {
  name: "Alpha",
  rank: "R3",
  minScore: 2000000,
  minDonation: 30000,
  notes: "an officer remark",
  kpis: [["Rank", "R3"], ["Nomination score", 71.5], ["AD participation", 1], ["AD growth", 0.1386], ["Weeks at AD target", "4/4"], ["Avg donation", 50225]],
  weeks: [
    { week: "2026-11-23", tech: 12650, honor: 2000, activity: 400 },
    { week: "2026-11-16", days: [10683729, 8222762, 8333156, 18980714, 12535943, 1729581], weekly: 63485885, donation: 29000, tech: 9850 },
  ],
  duties: [{ day: "2026-10-28", role: "Coachman", result: "Assigned", reason: "", special: true }],
};

describe("statsEmbeds", () => {
  const embeds = statsEmbeds(readStats(answer)!);

  it("puts the KPIs into a table, formatted, and the notes below", () => {
    expect(embeds[0]?.title).toBe("Alpha");
    expect(embeds[0]?.description).toContain("Nomination score    71.5");
    expect(embeds[0]?.description).toContain("AD participation    100%");
    expect(embeds[0]?.description).toContain("AD growth           +14%");
    expect(embeds[0]?.description).not.toContain("Rank ");
    expect(embeds[0]?.fields?.[0]?.value).toBe("an officer remark");
  });

  it("shows the AD weeks by duel day, marking days below the minimum", () => {
    const ad = embeds.find((e) => e.title === "Alliance Duel, in millions")?.description ?? "";
    expect(ad).toContain("Week      I   II  III    IV     V   VI  Total");
    expect(ad).toContain("16.11. 10.7  8.2  8.3  19.0  12.5  1.7*  63.5");
  });

  it("lists the weeks with donation and tracker values", () => {
    const w = embeds.find((e) => e.title === "Week by week")?.description ?? "";
    expect(w).toContain("23.11.     -      -  12.7K 2,000    400");
    expect(w).toContain("16.11. 63.5M    29K* 9,850     -      -");
  });

  it("tables the duties", () => {
    expect(embeds.find((e) => e.title === "Coachman Express duties")?.description).toContain("28.10. Coachman (MVP) Assigned");
  });

  it("refuses an answer without a name", () => {
    expect(readStats({ kpis: [] })).toBeUndefined();
  });
});
