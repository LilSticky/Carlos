import { describe, expect, it } from "vitest";
import { openMemoryDatabase } from "../storage/link-store.js";
import { DailyStore } from "../storage/daily-store.js";
import { DAILY_LEAD_MS, dailyDue, dailyEmbed, dailyMessage, readDaily } from "./daily.js";

const fromAt = Date.UTC(2026, 10, 26, 19, 30);
const raw = { text: "Choo choo! Ride with Alpha today, boarding 18:00 server time.", day: "2026-11-26", coach: "Alpha", fromAt, byAt: fromAt + 1_800_000 };
const daily = readDaily(raw)!;

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

  it("posts a card with Discord timestamps, mentioning only a linked driver and never @here", () => {
    const from = Math.floor(fromAt / 1000), by = from + 1800;
    const linked = dailyMessage(daily, "123");
    expect(linked.users).toEqual(["123"]);
    expect(linked.content).toContain("<@123>");
    const card = linked.embeds[0]!;
    expect(card.fields?.[0]).toMatchObject({ name: "Coach", value: "<@123>" });
    const text = JSON.stringify(card);
    expect(text).toContain(`<t:${from}:t>-<t:${by}:t>`);
    expect(text).toContain(`<t:${from}:R>`);
    expect(text).toContain(`<t:${by}:f>`);
    expect(text).not.toContain("server time");
    const unlinked = dailyMessage(daily, undefined);
    expect(unlinked.users).toEqual([]);
    expect(unlinked).not.toHaveProperty("content");
    expect(unlinked.embeds[0]!.fields?.[0]!.value).toBe("**Alpha**");
    expect(JSON.stringify([linked, unlinked])).not.toContain("@here");
  });

  it("names the day, the guard, an MVP and a new time when a newer sheet sends them", () => {
    const card = dailyEmbed(readDaily({ ...raw, index: 6, guard: "Beta", mvp: true, tag: "Voted in", changed: true })!, undefined);
    expect(card.title).toBe("Coachman Express · Rest Day · 26.11.");
    expect(card.description).toContain("our MVP **Alpha**");
    expect(card.description).toContain("*Voted in*");
    expect(card.fields?.map((f) => f.name)).toEqual(["MVP coach", "Guard", "Set-up (new time)", "Boarding"]);
    expect(dailyEmbed(daily, undefined).title).toBe("Coachman Express · 26.11.");
  });

  it("remembers the days it posted", () => {
    const store = new DailyStore(openMemoryDatabase());
    expect(store.posted("2026-11-26")).toBe(false);
    store.markPosted("2026-11-26", "111", "222", new Date());
    expect(store.posted("2026-11-26")).toBe(true);
    expect(store.posted("2026-11-27")).toBe(false);
  });
});
