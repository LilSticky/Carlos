import { describe, expect, it } from "vitest";
import { cut, dayMonth, percent, short, table } from "./format.js";

describe("short", () => {
  it("writes Might the way the game does", () => {
    expect(short(83775007)).toBe("83.8M");
    expect(short(19600000)).toBe("19.6M");
    expect(short(120000000)).toBe("120M");
    expect(short(570000)).toBe("570K");
    expect(short(63600)).toBe("63.6K");
    expect(short(5625)).toBe("5,625");
    expect(short(2.5e9)).toBe("2.5B");
    expect(short(null)).toBe("-");
  });
});

describe("percent and dates", () => {
  it("signs growth and writes dates day first", () => {
    expect(percent(0.1386)).toBe("+14%");
    expect(percent(-0.05)).toBe("-5%");
    expect(percent(0.71, false)).toBe("71%");
    expect(dayMonth("2026-11-16")).toBe("16.11.");
  });
});

describe("table", () => {
  it("aligns text left and numbers right, in a code block", () => {
    expect(table(["Hero", "Lv"], [["Arthur", "140"], ["Bell", "9"]], ["l", "r"])).toBe(
      ["```", "Hero    Lv", "Arthur 140", "Bell     9", "```"].join("\n"),
    );
  });
});

describe("cut", () => {
  it("keeps short texts and ends long ones with an ellipsis", () => {
    expect(cut("abc", 5)).toBe("abc");
    expect(cut("abcdef", 4)).toBe("abc…");
  });
});
