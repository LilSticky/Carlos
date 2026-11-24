import { describe, expect, it } from "vitest";
import { farmCard, farmOptions, farmsText, readFarmList, readHit, readRetrace, short, type Farm, type FarmList } from "./farms.js";

const luzia: Farm = {
  key: "330|luzia1",
  player: "Luzia1",
  kingdom: "330",
  location: "X:749 Y:920",
  seen: "scout 2026-11-19 19:03",
  status: "Ready",
  grain: 144_000_000,
  timber: 102_000_000,
  herb: 114_000_000,
  total: 360_000_000,
  power: 12_300_000,
  hits: 0,
  by: "",
  readyAt: null,
  note: "",
};
const kharap: Farm = { ...luzia, key: "330|kharap", player: "kharap", total: 207_000_000, status: "Cooldown", readyAt: "2026-11-25 04:00", by: "Ali", hits: 1 };
const gone: Farm = { ...luzia, key: "330|gone", player: "Gone1", status: "Gone" };
const list: FarmList = { farms: [luzia, kharap, gone], cooldownHours: 8 };

describe("short", () => {
  it("keeps the game's units", () => {
    expect(short(144_000_000)).toBe("144M");
    expect(short(8_300_000)).toBe("8.3M");
    expect(short(14_900)).toBe("15K");
    expect(short(1_250_000_000)).toBe("1.3B");
    expect(short(950)).toBe("950");
  });
});

describe("reading the sheet's answers", () => {
  it("reads the list, a hit and a retrace", () => {
    expect(readFarmList(list)).toEqual(list);
    expect(readHit({ farm: kharap })).toEqual(kharap);
    expect(readRetrace({ farm: luzia, outcome: "moved", text: "moved" })?.outcome).toBe("moved");
  });
  it("refuses answers it cannot read", () => {
    expect(readFarmList({ farms: [{ player: "x" }], cooldownHours: 8 })).toBeUndefined();
    expect(readFarmList([luzia])).toBeUndefined();
    expect(readRetrace({ farm: luzia, outcome: "lost", text: "" })).toBeUndefined();
  });
});

describe("farmsText", () => {
  it("lists ready and cooldown farms and counts the gone ones", () => {
    const text = farmsText(list);
    expect(text).toContain("1 ready, 1 on cooldown, 1 gone or tagged");
    expect(text).toContain("rests a farm for 8 h");
    expect(text).toContain("1. **Luzia1** 360M (grain 144M · timber 102M · herb 114M) · power 12.3M");
    expect(text).toContain("#330 X:749 Y:920 · ready, scout 2026-11-19 19:03");
    expect(text).toContain("cooldown until 2026-11-25 04:00 (hit by Ali)");
    expect(text).not.toContain("Gone1");
    expect(text).toContain("Pick the farm");
  });
  it("leaves out resources and power the report did not show", () => {
    expect(farmsText({ farms: [{ ...luzia, timber: null, power: null }], cooldownHours: 8 })).toContain("(grain 144M · herb 114M)\n");
  });
  it("shows the first ones and counts the rest", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...luzia, key: `k${i}`, player: `P${i}` }));
    const text = farmsText({ farms: many, cooldownHours: 8 }, 15);
    expect(text).toContain("15. **P14**");
    expect(text).not.toContain("**P15**");
    expect(text).toContain("and 5 more");
  });
  it("says why the list is empty", () => {
    expect(farmsText({ farms: [], cooldownHours: 8 })).toContain("scout reports");
    expect(farmsText({ farms: [gone], cooldownHours: 8 })).toContain("1 gone");
  });
});

describe("farmOptions", () => {
  it("offers only the ready farms, at most 25", () => {
    expect(farmOptions(list)).toEqual([{ label: "Luzia1 · 360M", value: "330|luzia1", description: "#330 X:749 Y:920 · power 12.3M" }]);
    const many = Array.from({ length: 30 }, (_, i) => ({ ...luzia, key: `k${i}` }));
    expect(farmOptions({ farms: many, cooldownHours: 8 })).toHaveLength(25);
  });
});

describe("farmCard", () => {
  it("says where to go and how long it rests", () => {
    const text = farmCard(kharap, "You hit **kharap**.");
    expect(text).toContain("**kharap** at **#330 X:749 Y:920**");
    expect(text).toContain("On cooldown until 2026-11-25 04:00 server time, hit by Ali.");
    expect(text).toContain("Gone? Retrace");
  });
  it("drops the retrace hint for a player now in an alliance", () => {
    expect(farmCard({ ...luzia, status: "Tagged", note: "[ABC]" }, "x")).toContain("Marked Tagged [ABC].");
    expect(farmCard({ ...luzia, status: "Tagged", note: "[ABC]" }, "x")).not.toContain("Retrace");
  });
});
