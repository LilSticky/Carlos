import { describe, expect, it } from "vitest";
import { dueNow, inviteEmbed, planEmbeds, planHelpers, readJoin, readNext, readPlan, type NextSiege } from "./siege.js";

const next: NextSiege = {
  run: "2026-11-26 20:00",
  start: new Date("2026-11-26T22:00:00Z"),
  stage: 4,
  inviteAt: new Date("2026-11-26T21:30:00Z"),
  planAt: new Date("2026-11-26T21:50:00Z"),
  signedUp: ["Ann", "Bo"],
};
const none = { inviteMessageId: null, planPosted: false };
const at = (iso: string) => new Date(iso);

describe("readNext", () => {
  it("reads a siege, no siege and garbage", () => {
    expect(readNext({ ...next, start: next.start.toISOString(), inviteAt: next.inviteAt.toISOString(), planAt: next.planAt.toISOString() })).toEqual(next);
    expect(readNext({ run: null })).toBeNull();
    expect(readNext({ run: "x" })).toBeUndefined();
  });
});

describe("dueNow", () => {
  it("posts nothing before the invitation time", () => {
    expect(dueNow(next, none, at("2026-11-26T21:29:00Z"))).toBeNull();
  });
  it("invites once from the invitation time until the start", () => {
    expect(dueNow(next, none, at("2026-11-26T21:30:00Z"))).toBe("invite");
    expect(dueNow(next, { inviteMessageId: "1", planPosted: false }, at("2026-11-26T21:40:00Z"))).toBeNull();
  });
  it("posts the plan from its time, also when the invitation was missed, and only once", () => {
    expect(dueNow(next, { inviteMessageId: "1", planPosted: false }, at("2026-11-26T21:50:00Z"))).toBe("plan");
    expect(dueNow(next, none, at("2026-11-26T22:05:00Z"))).toBe("plan");
    expect(dueNow(next, { inviteMessageId: "1", planPosted: true }, at("2026-11-26T21:55:00Z"))).toBeNull();
    expect(dueNow(next, none, at("2026-11-26T22:30:00Z"))).toBeNull();
  });
});

describe("texts", () => {
  it("shows the start in Discord time and who signed up", () => {
    const e = inviteEmbed(next);
    expect(e.title).toBe("Undead Siege - Stage 4");
    expect(e.description).toContain(`<t:${next.start.getTime() / 1000}:t>`);
    expect(e.fields[0]).toEqual({ name: "Signed up (2)", value: "Ann, Bo" });
    expect(inviteEmbed(next, true).description).toContain("closed");
  });

  const plan = readPlan({
    run: next.run,
    start: next.start.toISOString(),
    stage: 4,
    summary: "Stage 4, 3 attacked.",
    positions: "tracker 2026-11-26 19:40",
    signedUp: ["Ann", "Bo"],
    attacked: [
      { name: "Cy", signedUp: false, alone: 6, withHelp: 14, helpers: ["Ann (Squad 2)", "Bo (Squad 2)"] },
      { name: "Ann", signedUp: true, alone: 20, withHelp: 20, helpers: [] },
    ],
    skipped: [{ name: "Dee", why: "offline more than 72 h" }],
    orders: [
      { helper: "Bo", squad: "Squad 2", target: "Cy", distance: 7 },
      { helper: "Ann", squad: "Squad 2", target: "Cy", distance: null },
      { helper: "Ann", squad: "Squad 3", target: "Bo", distance: 3 },
    ],
  });

  it("reads the plan and groups the orders by helper", () => {
    expect(plan).toBeDefined();
    const [e] = planEmbeds(plan!);
    expect(e!.description).toContain("**Ann**: Squad 2 to **Cy**, Squad 3 to **Bo** (3 tiles)");
    expect(e!.description).toContain("**Bo**: Squad 2 to **Cy** (7 tiles)");
    expect(e!.description).toContain("Cy: 6 alone, 14 with help (not signed up)");
    expect(e!.description).toContain("Ann: 20 alone");
    expect(planHelpers(plan!)).toEqual(["Bo", "Ann"]);
  });

  it("splits a long plan over several embeds", () => {
    const orders = Array.from({ length: 200 }, (_, i) => ({ helper: `Member ${i}`, squad: "Squad 2", target: "Cy", distance: 5 }));
    const embeds = planEmbeds({ ...plan!, orders });
    expect(embeds.length).toBeGreaterThan(1);
    for (const e of embeds) expect(e.description.length).toBeLessThanOrEqual(4096);
  });

  it("reads the join answer", () => {
    expect(readJoin({ run: "r", added: true, signedUp: ["Ann"] })).toEqual({ run: "r", added: true, signedUp: ["Ann"] });
    expect(readJoin({})).toBeUndefined();
  });
});
