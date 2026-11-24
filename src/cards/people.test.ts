import { describe, expect, it } from "vitest";
import { PeopleList, readPeople, suggestPeople } from "./people.js";

const people = readPeople([
  { name: "Bravo", member: true, kingdom: "330", alliance: "REB" },
  { name: "Abravo", member: false, kingdom: 329, alliance: "ONE" },
  { name: "Brave", member: false, kingdom: "329", alliance: "ONE" },
  { nope: 1 },
]);

describe("people", () => {
  it("reads the list and skips broken entries", () => {
    expect(people.map((p) => p.name)).toEqual(["Bravo", "Abravo", "Brave"]);
    expect(people[1]?.kingdom).toBe("329");
  });

  it("suggests names that start with the text first, members first, and labels the others' side", () => {
    expect(suggestPeople(people, "bra")).toEqual([
      { name: "Bravo", value: "Bravo" },
      { name: "Brave  [ONE] · Kingdom #329", value: "Brave" },
      { name: "Abravo  [ONE] · Kingdom #329", value: "Abravo" },
    ]);
  });

  it("loads once in the background and answers from the cache", async () => {
    let loads = 0, now = 0;
    const list = new PeopleList(async () => { loads++; return people; }, () => now, 1000);
    expect(list.peek()).toEqual([]);
    await list.refresh();
    expect(loads).toBe(1);
    expect(list.peek()).toHaveLength(3);
    now = 1000;
    list.peek();
    await list.refresh();
    expect(loads).toBe(2);
  });
});
