import { describe, expect, it } from "vitest";
import { buildCommands } from "./commands.js";
import { fill, FUCKOFF, fuckoffCommand, isOwner, LEAVING, NOT_YOURS, pick, SNUBS, Sulk, SULK_MS, timeLeft } from "./fuckoff.js";

describe("/fuckoff", () => {
  it("belongs to LittleGrayFoxy only, however the linked name is written", () => {
    expect(isOwner("LittleGrayFoxy")).toBe(true);
    expect(isOwner("littlegrayfoxy")).toBe(true);
    expect(isOwner("Little Gray Foxy")).toBe(true);
    expect(isOwner("LittleGrayFox")).toBe(false);
    expect(isOwner(undefined)).toBe(false);
  });

  it("sulks for five minutes, then comes back", () => {
    const sulk = new Sulk();
    expect(sulk.left(1000)).toBe(0);
    sulk.start(1000);
    expect(sulk.left(1000)).toBe(SULK_MS);
    expect(sulk.left(1000 + SULK_MS - 1)).toBe(1);
    expect(sulk.left(1000 + SULK_MS)).toBe(0);
  });

  it("says how long the sulk still lasts", () => {
    expect(timeLeft(SULK_MS)).toBe("5 minutes");
    expect(timeLeft(61_000)).toBe("2 minutes");
    expect(timeLeft(60_000)).toBe("1 minute");
    expect(timeLeft(42_000)).toBe("42 s");
    expect(timeLeft(0)).toBe("1 s");
    for (const s of SNUBS) expect(fill(s, 42_000)).not.toContain("{left}");
  });

  it("picks every line and never runs off the end", () => {
    expect(pick(LEAVING, () => 0)).toBe(LEAVING[0]);
    expect(pick(LEAVING, () => 0.9999)).toBe(LEAVING[LEAVING.length - 1]);
    expect(pick(NOT_YOURS, () => 1)).toBe(NOT_YOURS[NOT_YOURS.length - 1]);
  });

  it("stays out of /help: registered on its own, not in the command list", () => {
    expect(fuckoffCommand.toJSON().name).toBe(FUCKOFF);
    expect(buildCommands({}).map((c) => c.name)).not.toContain(FUCKOFF);
  });

  it("is polite to everyone else", () => {
    for (const line of NOT_YOURS) expect(line.toLowerCase()).not.toContain("fuck");
  });
});
