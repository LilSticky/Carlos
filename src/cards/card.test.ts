import { describe, expect, it } from "vitest";
import { cardEmbeds, COLORS, epigraphText, factionBonusText, gearText, readCard } from "./card.js";

const heroes = [
  { hero: "Hero A", level: 140, stars: 8, gear: "20/40/20/30", gearQuality: "orange/orange/orange/orange", skills: "12/20/14/15", faction: "Warrior" },
  { hero: "Hero B", level: 140, stars: 10, gear: "60/30/40/40", gearQuality: "red/orange/orange/orange", skills: "18/30/30/30", faction: "Warrior" },
];
const memberAnswer = {
  matches: [
    { name: "Alpha", kingdom: "330", alliance: "REB", member: true },
    { name: "Alphonse", kingdom: "329", alliance: "ONE", member: false },
  ],
  player: {
    name: "Alpha", member: true, kingdom: "330", alliance: "REB", rank: "R4",
    tracker: { might: 83775007, level: 28, kills30: 338193, battleKills: 336565, battleMightLost: 20889471, mightPlace: 8, of: 100 },
    readiness: { score: 36, bledOut: true, mightPeak: 89810077, lastBattle: "2026-11-21", lost: 20889471, regained: "14854401", why: "bled out: Might 7% below its peak", updated: "2026-11-24" },
    intel: {
      reports: 2, lastSeen: "2026-11-24 15:14:14", bestPower: 19600000, lineup: 15100000, raven: 6900000, tech: 3100000,
      curio: 570000, soldier: 4400000, hallOfHonor: 63600, playerLevel: 28, ravenLevel: "Lv.125 5* skill Lv.125 5*",
      epigraphs: "orange 3/orange 3/orange 3/purple 4", faction: "Warrior",
      squads: [{ n: 1, seen: "2026-11-24", result: "Defeat", power: 19600000, lineup: 15100000, raven: 6900000, tech: 3100000, ravenLevel: 125, ravenStars: 5, ravenSkillLevel: 125, ravenSkillStars: 4, troopTier: "T9", heroes }],
    },
  },
};

describe("readCard", () => {
  it("reads the sheet's answer and drops what it cannot use", () => {
    const card = readCard({ ...memberAnswer, player: { ...memberAnswer.player, tracker: "nonsense" } });
    expect(card?.player?.name).toBe("Alpha");
    expect(card?.player?.tracker).toBeUndefined();
    expect(readCard({ player: 5 })?.player).toBeNull();
  });
});

describe("cardEmbeds", () => {
  const [profile, squad] = cardEmbeds(readCard(memberAnswer)!);

  it("heads the card with name, side, rank, level and faction", () => {
    expect(profile?.title).toBe("Alpha");
    expect(profile?.author?.name).toBe("[REB] · Kingdom #330");
    expect(profile?.description).toBe("R4 · Level 28 · Warrior");
    expect(profile?.color).toBe(COLORS.bledOut);
  });

  it("shows Might, readiness and report values as fields", () => {
    const f = Object.fromEntries((profile?.fields ?? []).map((x) => [x.name, x.value]));
    expect(f["Might"]).toBe("83.8M");
    expect(f["Place in the alliance"]).toBe("#8 of 100");
    expect(f["Combat readiness"]).toBe("**36**/100 · bled out");
    expect(f["Last battle"]).toBe("2026-11-21: lost 20.9M, 71% back");
    expect(f["Raven"]).toBe("Lv.125 5★ · skill Lv.125 4★");
    expect(f["Epigraphs"]).toBe("3× orange 3, purple 4");
    expect(f["Also found"]).toBe("Alphonse ([ONE] · Kingdom #329)");
    expect(f["Last seen at"]).toBeUndefined(); // never where our own members sit
  });

  it("leaves out what is not known", () => {
    const f = (profile?.fields ?? []).map((x) => x.name);
    expect(f).not.toContain("Arena");
    expect(f).not.toContain("Might, 30 days");
  });

  it("gives each squad a hero table with gear and skills", () => {
    expect(squad?.title).toBe("Squad 1 · 19.6M battle power");
    expect(squad?.description).toContain("Hero B 140 10 60+ 30 40 40 18 30 30 30");
    expect(squad?.footer?.text).toBe("Seen 2026-11-24 · Defeat");
  });

  it("shows a player of another alliance in their colour, with where they were seen", () => {
    const other = readCard({
      matches: [],
      player: { name: "Zed", member: false, kingdom: "329", alliance: "ONE", intel: { reports: 1, location: "X:128 Y:128", bestPower: 15700000 } },
    })!;
    const [p] = cardEmbeds(other);
    expect(p?.color).toBe(COLORS.theirs);
    expect(p?.fields?.find((x) => x.name === "Last seen at")?.value).toBe("X:128 Y:128");
  });

  it("says so when nothing is known", () => {
    const [p] = cardEmbeds(readCard({ matches: [], player: { name: "New", member: true, kingdom: "330", alliance: "REB" } })!);
    expect(p?.description).toContain("Nothing known yet");
  });

  it("lists the squad setups per kind of fight, one line per lineup", () => {
    const withRoster = structuredClone(memberAnswer) as typeof memberAnswer & { player: { intel: { roster: unknown[] } } };
    withRoster.player.intel.roster = [
      { group: "PvP seen", setup: "Pure Warrior 1", heroes: "Hero A 140 8*, Hero B 140 10*", bonus: "20%", power: 19600000, powerFrom: "Battle power", seen: "2026-11-24" },
      { group: "PvP seen", setup: "Bait", heroes: "Hero D 50 2*", losses: 0, seen: "2026-11-21" },
      { group: "PvP calculated", setup: "Mightiest 5", heroes: "Hero A 140 8*", bonus: "10%", power: 8626140, powerFrom: "Hero Might + 10%" },
      { group: "Demon King", setup: "Warrior 1", damage: 1577535551, seen: "2026-11-25" },
      { group: "Undead Siege", setup: "2026-11-24 squad 1", power: 12800000, losses: 2 },
    ];
    const embeds = cardEmbeds(readCard(withRoster)!);
    const roster = embeds.find((e) => e.title === "Squad setups");
    const f = Object.fromEntries((roster?.fields ?? []).map((x) => [x.name, x.value]));
    expect(f["PvP seen"]).toBe(
      "Pure Warrior 1: **19.6M** Hero A 140 8★, Hero B 140 10★ · 20% bonus · 2026-11-24\nBait: **0 lost** Hero D 50 2★ · 2026-11-21",
    );
    expect(f["PvP calculated"]).toBe("Mightiest 5: **8.6M Might** Hero A 140 8★ · 10% bonus");
    expect(f["Demon King"]).toBe("Warrior 1: **1.6B damage** heroes not seen · 2026-11-25");
    expect(f["Undead Siege"]).toBe("2026-11-24 squad 1: **12.8M** heroes not seen");
    expect(embeds[1]).toBe(roster); // right after the profile
  });

  it("stays within Discord's 6000 characters", () => {
    const big = structuredClone(memberAnswer);
    big.player.intel.squads = [1, 2, 3, 4].map((n) => ({ ...memberAnswer.player.intel.squads[0]!, n }));
    const all = cardEmbeds(readCard(big)!);
    expect(all.length).toBeLessThanOrEqual(10);
    expect(JSON.stringify(all).length).toBeLessThan(6000 + 500);
  });
});

describe("factionBonusText", () => {
  const base = { n: 1, heroes: [] };
  it("shows the worked-out bonus with the heroes' factions and the Might it adds", () => {
    expect(factionBonusText({ ...base, factionPercent: 20, factionSame: 5, factionMix: "5 Warlock", factionKnown: true, lineupBonus: 2100000 }))
      .toBe("20% · 5 Warlock · +2.1M Might");
    expect(factionBonusText({ ...base, factionPercent: 0, factionSame: 2, factionMix: "2 Warrior, 2 Ranger, 1 Warlock", factionKnown: true }))
      .toBe("0% · 2 Warrior, 2 Ranger, 1 Warlock");
  });
  it("says the bonus may be higher while a hero's faction is unknown", () => {
    expect(factionBonusText({ ...base, factionPercent: 15, factionSame: 4, factionMix: "4 Warrior, 1 unknown", factionKnown: false }))
      .toBe("15% or more · 4 Warrior, 1 unknown");
  });
  it("falls back to the report's own percentage without heroes", () => {
    expect(factionBonusText({ ...base, factionBonus: "20%" })).toBe("20%");
    expect(factionBonusText(base)).toBeUndefined();
  });
});

describe("texts", () => {
  it("marks red gear and counts epigraphs", () => {
    expect(gearText("60/30", "red/orange")).toBe("60+ 30");
    expect(gearText(undefined, undefined)).toBe("-");
    expect(epigraphText("a/a/b")).toBe("2× a, b");
  });
});
