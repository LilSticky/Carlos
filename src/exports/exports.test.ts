import { describe, expect, it } from "vitest";
import { SheetError } from "../sheet/sheet.js";
import { MEMBER_TEXTS, runExport, TEXTS, toMessages, type CallSheet } from "./exports.js";

const schedule = TEXTS.schedule;
const driver = TEXTS.driver;
const week = TEXTS.events;

const answering = (answer: unknown) => {
  const calls: unknown[][] = [];
  const call: CallSheet = async (...args) => {
    calls.push(args);
    return answer;
  };
  return { call, calls };
};
const member = { post: false, isOfficer: async () => false };
const officer = (post = false) => ({ post, isOfficer: async () => true });

describe("TEXTS", () => {
  it("keys every text by its own key", () => {
    for (const [key, def] of Object.entries(TEXTS)) expect(def.key).toBe(key);
    expect(TEXTS["ad-tomorrow"].args).toEqual({ offset: 1 });
  });

  it("keeps the officer texts out of the member texts", () => {
    expect(MEMBER_TEXTS).toEqual(["schedule", "today", "rules", "driverguide", "events", "ad-today", "ad-tomorrow", "elixir", "kvk"]);
    expect(Object.values(TEXTS).filter((d) => d.officersOnly).map((d) => d.key)).toEqual(["driver", "notice", "nominees", "guards"]);
  });
});

describe("runExport", () => {
  it("shows a locked-in schedule to a member, asking the Coachman Express", async () => {
    const s = answering({ text: "Day I: Alpha", draft: false });
    expect(await runExport(schedule, member, s.call)).toEqual({
      kind: "shown", def: schedule, parts: ["Day I: Alpha"], post: false, draft: false, lockedNow: false,
    });
    expect(s.calls).toEqual([["coachman", "schedule", {}]]);
  });

  it("keeps a draft schedule from members but shows it to officers", async () => {
    expect(await runExport(schedule, member, answering({ text: "x", draft: true }).call)).toEqual({ kind: "draft" });
    expect(await runExport(schedule, officer(), answering({ text: "x", draft: true }).call)).toMatchObject({ kind: "shown", draft: true });
  });

  it("lets only officers post, and tells the sheet it is posted", async () => {
    expect(await runExport(schedule, { post: true, isOfficer: async () => false }, answering({ text: "x" }).call)).toEqual({ kind: "officers-only" });
    const s = answering({ text: "x", draft: false, lockedNow: true });
    expect(await runExport(schedule, officer(true), s.call)).toMatchObject({ kind: "shown", post: true, lockedNow: true });
    expect(s.calls[0]).toEqual(["coachman", "schedule", { post: true }]);
  });

  it("keeps officer texts from members", async () => {
    const s = answering({ text: "x" });
    expect(await runExport(driver, member, s.call)).toEqual({ kind: "officers-only" });
    expect(s.calls).toEqual([]);
  });

  it("takes texts in several parts, without empty ones", async () => {
    expect(await runExport(week, member, answering({ parts: ["(1/2) a", " ", "(2/2) b"] }).call)).toMatchObject({ parts: ["(1/2) a", "(2/2) b"] });
  });

  it("passes the sheet's own error on", async () => {
    const call: CallSheet = async () => {
      throw new SheetError("No coachman for Day II yet. Fill in the schedule first.");
    };
    expect(await runExport(TEXTS.today, member, call)).toEqual({
      kind: "failed", error: "No coachman for Day II yet. Fill in the schedule first.", setup: false,
    });
  });

  it("calls an unreadable answer a setup problem", async () => {
    expect(await runExport(week, member, answering({ nothing: 1 }).call)).toMatchObject({ kind: "failed", setup: true });
  });
});

describe("toMessages", () => {
  it("puts chat texts into code blocks and leaves Discord texts as they are", () => {
    expect(toMessages(["a\nb"], true)).toEqual(["```\na\nb\n```"]);
    expect(toMessages(["**a**"], false)).toEqual(["**a**"]);
  });

  it("splits a long text at line breaks, and a long line anywhere", () => {
    expect(toMessages(["aaaa\nbbbb\ncc"], false, 9)).toEqual(["aaaa\nbbbb", "cc"]);
    expect(toMessages(["abcdefghij"], false, 4)).toEqual(["abcd", "efgh", "ij"]);
    for (const m of toMessages(["x".repeat(5000)], true)) expect(m.length).toBeLessThanOrEqual(2000);
  });

  it("keeps a code block closed", () => {
    expect(toMessages(["a ``` b"], true)).toEqual(["```\na ''' b\n```"]);
  });
});
