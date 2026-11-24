import { describe, expect, it } from "vitest";
import { buildCommands } from "./commands.js";

const url = "https://script.google.com/macros/s/x/exec";

describe("buildCommands", () => {
  it("offers only /iam and /link without sheet links", () => {
    expect(buildCommands({}).map((c) => c.name)).toEqual(["iam", "link"]);
  });

  it("adds the commands of each linked sheet", () => {
    expect(buildCommands({ coachman: url, events: url, kvk: url, stats: url }).map((c) => c.name)).toEqual([
      "iam", "link", "player", "coachman", "events", "kvk", "vote",
    ]);
  });

  it("gives a command with several texts a required choice, and every export a post option", () => {
    const [coachman] = buildCommands({ coachman: url }).filter((c) => c.name === "coachman");
    expect(coachman?.options?.map((o) => [o.name, o.required ?? false])).toEqual([["what", true], ["post", false]]);
    const [kvk] = buildCommands({ kvk: url }).filter((c) => c.name === "kvk");
    expect(kvk?.options?.map((o) => o.name)).toEqual(["post"]);
  });
});
