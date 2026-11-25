import { describe, expect, it } from "vitest";
import { dayName, scheduleData, scheduleEmbed } from "./schedule.js";

const day = (index: number, extra: Record<string, unknown> = {}) => ({
  index,
  dateFile: `2026-11-${String(23 + index).padStart(2, "0")}`,
  dateText: "ignored",
  coach: "Alpha",
  coachBackup: "Beta",
  guard: "Gamma",
  guardBackup: "",
  mvp: false,
  tag: "",
  ways: [],
  medals: [],
  trial: false,
  time: { from: "17:30", by: "18:00", text: "17:30-18:00", changed: false },
  ...extra,
});

describe("schedule card", () => {
  it("names the days the way the Alliance Duel counts", () => {
    expect([0, 3, 5, 6].map(dayName)).toEqual(["Day I", "Day IV", "Day VI", "Rest Day"]);
  });

  it("shows one field per day, the next stop first, with backups, new times and MVP reasons", () => {
    const data = scheduleData.parse({
      boarding: "Coachman set-up 17:30-18:00 server time, unless a day says otherwise",
      days: [
        day(3, { mvp: true, coachBackup: "", tag: "Donated every week", ways: [{ name: "Leadership vote", chip: "LEADERSHIP PICK" }], time: { text: "19:00-19:30", changed: true } }),
        day(4, { trial: true }),
        day(6, { guard: "" }),
      ],
    });
    const e = scheduleEmbed(data);
    expect(e.description).toContain("Still to come this week");
    expect(e.fields?.map((f) => f.name)).toEqual(["Day IV · 26.11. · next stop", "Day V · 27.11.", "Rest Day · 29.11."]);
    expect(e.fields?.[0]?.value).toBe(
      "Set-up **19:00-19:30** (new time)\nMVP coach: **Alpha** · Leadership pick\n*Donated every week*\nGuard: **Gamma**",
    );
    expect(e.fields?.[1]?.value).toBe("Coach: **Alpha** · backup Beta\nGuard on trial: **Gamma**");
    expect(e.fields?.[2]?.value).toBe("Coach: **Alpha** · backup Beta");
  });

  it("shows the set-up times as Discord timestamps when the sheet sends them, the next stop also how soon", () => {
    const at = (h: number) => Date.UTC(2026, 10, 26, h, 0);
    const data = scheduleData.parse({
      boarding: "Coachman set-up 17:30-18:00 server time, unless a day says otherwise",
      days: [day(3, { fromAt: at(19) - 1_800_000, byAt: at(20) }), day(4, { fromAt: at(43) - 1_800_000, byAt: at(44), time: { text: "x", changed: true } })],
    });
    const e = scheduleEmbed(data);
    const s = (ms: number) => Math.floor(ms / 1000);
    expect(e.description).toContain("your own time");
    expect(e.fields?.[0]?.value.split("\n")[0]).toBe(`Set-up **<t:${s(at(19) - 1_800_000)}:t>-<t:${s(at(20))}:t>** · <t:${s(at(19) - 1_800_000)}:R>`);
    expect(e.fields?.[1]?.value.split("\n")[0]).toBe(`Set-up **<t:${s(at(43) - 1_800_000)}:t>-<t:${s(at(44))}:t>** (new time)`);
  });

  it("reads no card from a sheet that sends only the text", () => {
    expect(scheduleData.safeParse({ text: "x" }).success).toBe(false);
  });
});
