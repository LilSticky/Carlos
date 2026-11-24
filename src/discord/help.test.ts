import { describe, expect, it } from "vitest";
import { buildCommands } from "./commands.js";
import { findHelp, helpDetails, helpOverview, LEAD_HELP, leadHelp, MEMBER_HELP, memberHelp } from "./help.js";

type Sheets = Parameters<typeof buildCommands>[0];
const url = "https://script.google.com/macros/s/x/exec";
const all: Sheets = { coachman: url, events: url, kvk: url, stats: url, members: url, siege: url };

describe("help", () => {
  it("explains every command and /lead subcommand Carlos offers, and nothing else", () => {
    for (const sheets of [{}, { events: url }, { stats: url }, all] as Sheets[]) {
      const commands = buildCommands(sheets);
      const subs = (commands.find((c) => c.name === "lead")?.options ?? []).map((s) => `lead ${s.name}`);
      expect(memberHelp(sheets).map((e) => e.name)).toEqual(commands.filter((c) => c.name !== "lead").map((c) => c.name));
      expect(leadHelp(sheets).map((e) => e.name)).toEqual(subs);
    }
  });

  it("gives each entry a summary, details and examples that fit in an embed", () => {
    for (const e of [...MEMBER_HELP, ...LEAD_HELP]) {
      const embed = helpDetails(e);
      expect(embed.title).toBe(`/${e.name}`);
      expect(e.examples.length).toBeGreaterThan(0);
      expect(e.examples.some(([typed]) => typed === `/${e.name}` || typed.startsWith(`/${e.name} `))).toBe(true);
      expect((embed.description ?? "").length).toBeLessThan(4096);
      for (const f of embed.fields ?? []) expect(f.value.length).toBeLessThanOrEqual(1024);
    }
  });

  it("shows the /lead part of the overview only to officers", () => {
    expect(helpOverview(all, false).fields?.map((f) => f.name)).toEqual(["Commands"]);
    const officer = helpOverview(all, true);
    expect(officer.fields?.map((f) => f.name)).toEqual(["Commands", "Officers (R4 and R5)"]);
    expect(officer.fields?.[1]?.value).toContain("/lead siege");
    for (const f of officer.fields ?? []) expect(f.value.length).toBeLessThanOrEqual(1024);
  });

  it("finds an entry by command, a /lead subcommand with its parent", () => {
    expect(findHelp("farms")?.name).toBe("farms");
    expect(findHelp("lead stats")?.name).toBe("lead stats");
    expect(findHelp("stats")).toBeUndefined();
    expect(findHelp("")).toBeUndefined();
  });
});
