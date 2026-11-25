import { describe, expect, it } from "vitest";
import { openMemoryDatabase } from "../storage/link-store.js";
import { DailyStore } from "../storage/daily-store.js";
import { DAILY_LEAD_MS, dailyDue, dailyMessage, readDaily } from "./daily.js";

const fromAt = Date.UTC(2026, 10, 26, 19, 30);
const daily = readDaily({ text: "Choo choo! Ride with Alpha today, boarding 18:00 server time.", day: "2026-11-26", coach: "Alpha", fromAt, byAt: fromAt + 1_800_000 })!;

describe("daily caravan post", () => {
  it("reads the sheet's answer, and nothing from an older sheet that sends only the text", () => {
    expect(daily.coach).toBe("Alpha");
    expect(readDaily({ text: "x" })).toBeUndefined();
  });

  it("is due from some hours before set-up until boarding, once", () => {
    expect(dailyDue(daily, false, new Date(fromAt - DAILY_LEAD_MS - 1))).toBe(false);
    expect(dailyDue(daily, false, new Date(fromAt - DAILY_LEAD_MS))).toBe(true);
    expect(dailyDue(daily, true, new Date(fromAt))).toBe(false);
    expect(dailyDue(daily, false, new Date(fromAt + 1_800_000))).toBe(false);
  });

  it("posts the message as it is, mentioning only a linked driver and never @here", () => {
    expect(dailyMessage(daily, "123")).toEqual({ content: `${daily.text}\nDriver: <@123>`, users: ["123"] });
    expect(dailyMessage(daily, undefined)).toEqual({ content: daily.text, users: [] });
    expect(dailyMessage(daily, "123").content).not.toContain("@here");
  });

  it("remembers the days it posted", () => {
    const store = new DailyStore(openMemoryDatabase());
    expect(store.posted("2026-11-26")).toBe(false);
    store.markPosted("2026-11-26", "111", "222", new Date());
    expect(store.posted("2026-11-26")).toBe(true);
    expect(store.posted("2026-11-27")).toBe(false);
  });
});
