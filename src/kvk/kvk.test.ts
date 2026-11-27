import { describe, expect, it } from "vitest";
import { kvkDue, kvkInviteEmbed, readinessEmbed, readKvkAnswer, readKvkNext, readKvkReadiness, type KvkReadiness, type NextKvk } from "./kvk.js";

const next: NextKvk = {
  day: "2026-11-28",
  inviteAt: new Date("2026-11-23T14:00:00Z"),
  closeAt: new Date("2026-11-28T02:00:00Z"),
  battleAt: new Date("2026-11-28T14:00:00Z"),
  open: true,
  yes: ["Ann"],
  no: ["Bo"],
  maybe: ["Cy"],
  members: 40,
};
const none = { inviteMessageId: null, readinessPosted: false };
const at = (iso: string) => new Date(iso);

const readiness: KvkReadiness = {
  day: "2026-11-28",
  battleAt: new Date("2026-11-28T14:00:00Z"),
  battleTime: "12:00-16:00",
  yes: { count: 2, might: 120_000_000, level: 28.5 },
  no: { count: 1, might: 40_000_000, level: 26 },
  maybe: { count: 3, might: 90_000_000, level: 27 },
  fromDiscord: 2,
  brackets: [
    { name: "Lv <27", count: 0, might: 0 },
    { name: "Lv 30", count: 2, might: 120_000_000 },
  ],
  strongest: [{ name: "Ann", might: 70_000_000 }],
  readiness: { min: 60, likely: { count: 1, might: 70_000_000, level: 30 }, unknown: 1, bled: ["Cy"] },
  noAnswer: ["Dee"],
  unsure: ["Eve"],
};

describe("readers", () => {
  it("read the sheet's answers and refuse garbage", () => {
    const raw = { ...next, inviteAt: next.inviteAt.toISOString(), closeAt: next.closeAt.toISOString(), battleAt: next.battleAt.toISOString() };
    expect(readKvkNext(raw)).toEqual(next);
    expect(readKvkNext({ day: "x" })).toBeUndefined();
    expect(readKvkAnswer({ day: "2026-11-28", vote: "No", changed: true, yes: [], no: ["Ann"] })?.vote).toBe("No");
    expect(readKvkAnswer({ day: "2026-11-28", vote: "Maybe", changed: true, yes: [], no: [], maybe: ["Ann"] })?.maybe).toEqual(["Ann"]);
    expect(readKvkAnswer({ day: "2026-11-28", vote: "Later", changed: true, yes: [], no: [] })).toBeUndefined();
    // a sheet without Don't know yet still reads
    expect(readKvkAnswer({ day: "2026-11-28", vote: "No", changed: true, yes: [], no: [] })?.maybe).toEqual([]);
    expect(readKvkReadiness({ ...readiness, battleAt: readiness.battleAt.toISOString() })).toEqual(readiness);
  });
});

describe("kvkDue", () => {
  it("posts nothing before the vote card's time", () => {
    expect(kvkDue(next, none, at("2026-11-23T13:59:00Z"))).toBeNull();
  });
  it("posts the vote card once while the vote is open", () => {
    expect(kvkDue(next, none, at("2026-11-23T14:00:00Z"))).toBe("invite");
    expect(kvkDue(next, { inviteMessageId: "1", readinessPosted: false }, at("2026-11-25T10:00:00Z"))).toBeNull();
  });
  it("posts the readiness card once when Day VI starts, also without a vote card, until the battle is over", () => {
    expect(kvkDue(next, { inviteMessageId: "1", readinessPosted: false }, at("2026-11-28T02:00:00Z"))).toBe("readiness");
    expect(kvkDue(next, none, at("2026-11-28T10:00:00Z"))).toBe("readiness");
    expect(kvkDue(next, { inviteMessageId: "1", readinessPosted: true }, at("2026-11-28T03:00:00Z"))).toBeNull();
    expect(kvkDue(next, none, at("2026-11-28T21:00:00Z"))).toBeNull();
  });
});

describe("cards", () => {
  it("lists who participates and who stays out, and closes", () => {
    const open = kvkInviteEmbed(next);
    expect(open.fields).toEqual([
      { name: "Participate (1)", value: "Ann" },
      { name: "Stay out (1)", value: "Bo" },
      { name: "Don't know yet (1)", value: "Cy" },
    ]);
    expect(open.description).toContain(`<t:${next.battleAt.getTime() / 1000}:t>`);
    expect(kvkInviteEmbed(next, true).description).toContain("closed");
  });
  it("sums up the vote and the battle strength", () => {
    const e = readinessEmbed(readiness);
    expect(e.description).toContain("**Participate: 2** · 120.0M Might");
    expect(e.description).toContain("No answer or don't know yet: 3 · 90.0M Might (1 don't know yet)");
    expect(e.fields.map((f) => f.name)).toEqual(["Likely to fight", "Participants by level", "Strongest", "Heal or shield before the battle"]);
    expect(e.fields[1]!.value).toBe("Lv 30: 2 · 120.0M");
    expect(readinessEmbed({ ...readiness, readiness: null }).fields.map((f) => f.name)).not.toContain("Likely to fight");
  });
});
