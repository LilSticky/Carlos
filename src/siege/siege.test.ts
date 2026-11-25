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

  it("puts each helper's squads on one line, then who gets help and who still falls", () => {
    expect(plan).toBeDefined();
    const atRisk = { name: "Eve", signedUp: false, alone: 9, withHelp: 9, helpers: [] };
    const [e, more] = planEmbeds({ ...plan!, attacked: [...plan!.attacked, atRisk] });
    expect(more).toBeUndefined();
    expect(e!.title).toBe("Undead Siege - Stage 4: defense plan");
    expect(e!.description).toContain("**43 of 60 waves** (35 without help)");
    expect(e!.fields).toEqual([
      { name: "Send your squads", value: "**Ann**: Squad 2 to Cy · Squad 3 to Bo (3 tiles)\n**Bo**: Squad 2 to Cy (7 tiles)" },
      { name: "Who gets help", value: "Cy: 6 → 14 waves" },
      { name: "Still falling before wave 20 (1)", value: "Eve 9" },
    ]);
    expect(e!.footer?.text).toContain("tracker 2026-11-26 19:40");
    expect(planHelpers(plan!)).toEqual(["Bo", "Ann"]);
  });

  it("names only the ten weakest members nobody helps", () => {
    const attacked = Array.from({ length: 14 }, (_, i) => ({ name: `M${i}`, signedUp: false, alone: i, withHelp: i, helpers: [] }));
    const [e] = planEmbeds({ ...plan!, attacked, orders: [] });
    expect(e!.fields[0]).toEqual({ name: "Send your squads", value: "None: nobody who signed up can add a wave." });
    expect(e!.fields[1]!.name).toBe("Still falling before wave 20 (14)");
    expect(e!.fields[1]!.value).toMatch(/^M0 0 · M1 1 .* M9 9 · and 4 more$/);
  });

  it("splits a long plan over several embeds within Discord's limits", () => {
    const orders = Array.from({ length: 200 }, (_, i) => ({ helper: `Member ${i}`, squad: "Squad 2", target: "Cy", distance: 5 }));
    const embeds = planEmbeds({ ...plan!, orders });
    expect(embeds.length).toBeGreaterThan(1);
    for (const e of embeds) {
      expect(e.fields.length).toBeLessThanOrEqual(25);
      for (const f of e.fields) expect(f.value.length).toBeLessThanOrEqual(1024);
      const size = (e.title?.length ?? 0) + (e.description?.length ?? 0) + e.fields.reduce((n, f) => n + f.name.length + f.value.length, 0) + (e.footer?.text.length ?? 0);
      expect(size).toBeLessThanOrEqual(6000);
    }
    expect(embeds[embeds.length - 1]!.footer).toBeDefined();
  });

  it("reads the join answer", () => {
    expect(readJoin({ run: "r", added: true, signedUp: ["Ann"] })).toEqual({ run: "r", added: true, signedUp: ["Ann"] });
    expect(readJoin({})).toBeUndefined();
  });
});
