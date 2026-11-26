import { describe, expect, it } from "vitest";
import { adDay, dayList, serverClock } from "./days.js";
import { dueQuests, questEmbed, questKey } from "./quest-post.js";
import { readScores } from "./scores.js";

const quest = {
  quest: "Barracks check", board: "Battle", from: "2026-11-26", until: "", days: "IV, Rest Day", type: "Barracks",
  note: "", runsToday: true, multiplier: 1, bonus: 20, reports: 0, points: 0, leader: "",
};
const scores = (q: object[], today = "2026-11-26") => readScores({ battle: [], scouting: [], since: "", today, quests: q })!;
// 2026-11-26 is Day IV; 12:00 UTC = 10:00 server time
const at = (iso: string) => new Date(iso);

describe("days", () => {
  it("reads the server clock (UTC-2)", () => {
    expect(serverClock(at("2026-11-27T01:30:00Z"))).toEqual({ day: "2026-11-26", hour: 23 });
  });
  it("counts the AD week from Monday", () => {
    expect([adDay("2026-11-23"), adDay("2026-11-26"), adDay("2026-11-29")]).toEqual([1, 4, 7]);
  });
  it("names the days in week order", () => {
    expect(dayList("Rest Day, IV")).toBe("Day IV and Rest Day");
    expect(dayList("Thursday")).toBe("");
  });
});

describe("dueQuests", () => {
  it("posts a repeating quest from 10:00 server time on", () => {
    expect(dueQuests(scores([quest]), at("2026-11-26T11:59:00Z"), () => false)).toHaveLength(0);
    const due = dueQuests(scores([quest]), at("2026-11-26T12:00:00Z"), () => false);
    expect(due.map((d) => d.key)).toEqual([questKey("2026-11-26", "Barracks check")]);
  });
  it("rides along with an earlier KvK vote card", () => {
    expect(dueQuests(scores([quest]), at("2026-11-26T08:00:00Z"), () => false, true)).toHaveLength(1);
  });
  it("posts once a day", () => {
    expect(dueQuests(scores([quest]), at("2026-11-26T15:00:00Z"), () => true)).toHaveLength(0);
  });
  it("skips quests that do not run today or have no days", () => {
    expect(dueQuests(scores([{ ...quest, runsToday: false }, { ...quest, days: "" }]), at("2026-11-26T15:00:00Z"), () => false)).toHaveLength(0);
  });
  it("waits while the sheet still answers for another day", () => {
    expect(dueQuests(scores([quest], "2026-11-25"), at("2026-11-26T15:00:00Z"), () => false)).toHaveLength(0);
  });
});

describe("questEmbed", () => {
  const e = questEmbed(scores([quest]).quests[0]!, "2026-11-26", "123");
  it("invites to the combat readiness check with the Barracks screenshot", () => {
    expect(e.title).toBe("Combat readiness check - Day IV");
    expect(e.description).toContain("**Barracks** window");
    expect(e.description).toContain("<#123>");
  });
  it("names the reward and the end of the server day", () => {
    expect(e.fields![0]!.value).toContain("**+20 points** on the Battle Scoreboard today");
    // 2026-11-27 02:00 UTC = 24:00 server time
    expect(e.fields![1]!.value).toContain(`<t:${Date.UTC(2026, 10, 27, 2) / 1000}:R>`);
    expect(e.footer!.text).toContain("Every Day IV and Rest Day.");
  });
  it("uses the note for other quests", () => {
    const o = questEmbed({ ...quest, quest: "Siege defenses", type: "Defense", note: "Send every defense you see." }, "2026-11-29", "123");
    expect(o.title).toBe("Siege defenses - Rest Day");
    expect(o.description).toBe("Send every defense you see.");
  });
});
