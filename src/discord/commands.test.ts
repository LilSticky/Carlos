import { describe, expect, it } from "vitest";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { MAX_PICTURES } from "../uploads/upload.js";
import { buildCommands, leadText, memberText, WHISPER_OPTIONS } from "./commands.js";

type Sheets = Parameters<typeof buildCommands>[0];
const url = "https://script.google.com/macros/s/x/exec";
const all: Sheets = { coachman: url, events: url, kvk: url, stats: url, members: url };
const lead = (sheets: Sheets) => buildCommands(sheets).find((c) => c.name === "lead");
const subcommands = (sheets: Sheets) => lead(sheets)?.options?.map((o) => o.name);

describe("buildCommands", () => {
  it("offers only /iam, /whisper and /lead without links to the other sheets", () => {
    expect(buildCommands({}).map((c) => c.name)).toEqual(["iam", "whisper", "lead"]);
  });

  it("puts /farms with Alliance Members, which keeps the list", () => {
    expect(buildCommands({ members: url }).map((c) => c.name)).toEqual(["iam", "whisper", "farms", "lead"]);
  });

  it("lets /whisper take up to 10 pictures, the first one required", () => {
    const [whisper] = buildCommands({}).filter((c) => c.name === "whisper");
    const options = whisper?.options ?? [];
    expect(options).toHaveLength(MAX_PICTURES);
    expect(options.map((o) => [o.name, o.type, o.required ?? false])[0]).toEqual(["picture", ApplicationCommandOptionType.Attachment, true]);
    expect(options.slice(1).every((o) => o.type === ApplicationCommandOptionType.Attachment && !o.required)).toBe(true);
    expect(options.map((o) => o.name)).toEqual(WHISPER_OPTIONS);
  });

  it("adds one member command per text of each linked sheet, and /lead last", () => {
    expect(buildCommands(all).map((c) => c.name)).toEqual([
      "iam", "whisper", "farms", "player", "schedule", "today", "rules", "driverguide", "events", "ad", "elixir", "kvk", "lead",
    ]);
    expect(buildCommands({ events: url }).map((c) => c.name)).toEqual(["iam", "whisper", "events", "ad", "elixir", "lead"]);
  });

  it("puts /player with Alliance Statistics, where the cards come from", () => {
    expect(buildCommands({ coachman: url }).map((c) => c.name)).not.toContain("player");
    expect(buildCommands({ stats: url }).map((c) => c.name)).toContain("player");
  });

  it("gives member commands nothing to pick and no option to post; /ad only an optional tomorrow", () => {
    const plain = buildCommands(all).filter((c) => !["iam", "whisper", "player", "lead", "ad"].includes(c.name));
    expect(plain.map((c) => c.name)).toEqual(["farms", "schedule", "today", "rules", "driverguide", "events", "elixir", "kvk"]);
    for (const c of plain) {
      expect(c.options ?? []).toEqual([]);
      expect(c.default_member_permissions ?? null).toBeNull();
    }
    const ad = buildCommands(all).find((c) => c.name === "ad");
    expect(ad?.options?.map((o) => [o.name, o.type, o.required ?? false])).toEqual([["tomorrow", ApplicationCommandOptionType.Boolean, false]]);
    const player = buildCommands(all).find((c) => c.name === "player");
    expect(player?.options?.map((o) => o.name)).toEqual(["name"]);
  });

  it("hides /lead from members who can't manage roles", () => {
    expect(lead({})?.default_member_permissions).toBe(String(PermissionFlagsBits.ManageRoles));
  });

  it("gives /lead the subcommands of the linked sheets", () => {
    expect(subcommands({})).toEqual(["link"]);
    expect(subcommands(all)).toEqual(["post", "link", "driver", "notice", "vote", "stats"]);
    expect(subcommands({ stats: url })).toEqual(["link", "vote", "stats"]);
  });

  it("lets /lead post only the member texts of linked sheets", () => {
    const post = lead({ kvk: url, events: url })?.options?.find((o) => o.name === "post");
    const what = post && "options" in post ? post.options?.[0] : undefined;
    expect(what && "choices" in what ? what.choices?.map((c) => c.value) : undefined).toEqual(["events", "ad-today", "ad-tomorrow", "elixir", "kvk"]);
  });
});

describe("memberText", () => {
  it("names the text a member command shows", () => {
    expect(memberText("today", false)).toBe("today");
    expect(memberText("ad", false)).toBe("ad-today");
    expect(memberText("ad", true)).toBe("ad-tomorrow");
    expect(memberText("iam", false)).toBeUndefined();
  });
});

describe("leadText", () => {
  it("names the text a /lead subcommand shows", () => {
    expect(leadText("post", "schedule")).toBe("schedule");
    expect(leadText("driver", null)).toBe("driver");
    expect(leadText("notice", null)).toBe("notice");
    expect(leadText("vote", "guards")).toBe("guards");
  });

  it("never posts an officer text, and refuses unknown choices", () => {
    expect(leadText("post", "driver")).toBeUndefined();
    expect(leadText("post", "nope")).toBeUndefined();
    expect(leadText("vote", "schedule")).toBeUndefined();
    expect(leadText("link", null)).toBeUndefined();
  });
});
