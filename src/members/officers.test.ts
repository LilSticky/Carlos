import { describe, expect, it } from "vitest";
import { isOfficer } from "./officers.js";

const deps = {
  memberOf: (id: string) => ({ "1": "alpha", "2": "Bravo" })[id],
  officers: async () => ["Alpha"],
};

describe("isOfficer", () => {
  it("is true for an account linked to an R4 or R5 of the sheet", async () => {
    expect(await isOfficer("1", deps)).toBe(true);
  });

  it("is false for other members and for accounts that are not linked", async () => {
    expect(await isOfficer("2", deps)).toBe(false);
    expect(await isOfficer("3", deps)).toBe(false);
  });
});
