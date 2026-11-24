import { describe, expect, it } from "vitest";
import { ApplicationCommandOptionType } from "discord.js";
import { MAX_PICTURES } from "../uploads/upload.js";
import { buildCommands, WHISPER_OPTIONS } from "./commands.js";

const url = "https://script.google.com/macros/s/x/exec";

describe("buildCommands", () => {
  it("offers only /iam, /link and /whisper without sheet links", () => {
    expect(buildCommands({}).map((c) => c.name)).toEqual(["iam", "link", "whisper"]);
  });

  it("lets /whisper take up to 10 pictures, the first one required", () => {
    const [whisper] = buildCommands({}).filter((c) => c.name === "whisper");
    const options = whisper?.options ?? [];
    expect(options).toHaveLength(MAX_PICTURES);
    expect(options.map((o) => [o.name, o.type, o.required ?? false])[0]).toEqual(["picture", ApplicationCommandOptionType.Attachment, true]);
    expect(options.slice(1).every((o) => o.type === ApplicationCommandOptionType.Attachment && !o.required)).toBe(true);
    expect(options.map((o) => o.name)).toEqual(WHISPER_OPTIONS);
  });

  it("adds the commands of each linked sheet", () => {
    expect(buildCommands({ coachman: url, events: url, kvk: url, stats: url }).map((c) => c.name)).toEqual([
      "iam", "link", "whisper", "player", "coachman", "events", "kvk", "vote",
    ]);
  });

  it("gives a command with several texts a required choice, and every export a post option", () => {
    const [coachman] = buildCommands({ coachman: url }).filter((c) => c.name === "coachman");
    expect(coachman?.options?.map((o) => [o.name, o.required ?? false])).toEqual([["what", true], ["post", false]]);
    const [kvk] = buildCommands({ kvk: url }).filter((c) => c.name === "kvk");
    expect(kvk?.options?.map((o) => o.name)).toEqual(["post"]);
  });
});
