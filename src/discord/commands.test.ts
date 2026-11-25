import { describe, expect, it } from "vitest";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { MAX_PICTURES } from "../uploads/upload.js";
import { buildCommands, HELP_OPTION, leadText, memberText, wantsHelp, WHISPER_OPTIONS } from "./commands.js";

type Sheets = Parameters<typeof buildCommands>[0];
const url = "https://script.google.com/macros/s/x/exec";
const all: Sheets = { coachman: url, events: url, kvk: url, stats: url, members: url };
const lead = (sheets: Sheets) => buildCommands(sheets).find((c) => c.name === "lead");
const subcommands = (sheets: Sheets) => lead(sheets)?.options?.map((o) => o.name);

describe("buildCommands", () => {
  it("offers only /iam, /whisper, /overlay and /lead without links to the other sheets", () => {
    expect(buildCommands({}).map((c) => c.name)).toEqual(["iam", "whisper", "overlay", "help", "lead"]);
  });

  it("puts /farms, /whois and /alliance with Alliance Members, which keeps the list and the tracker key", () => {
    expect(buildCommands({ members: url }).map((c) => c.name)).toEqual(["iam", "whisper", "overlay", "farms", "whois", "alliance", "help", "lead"]);
  });

  it("lets /whisper take up to 10 pictures, then help", () => {
    const [whisper] = buildCommands({}).filter((c) => c.name === "whisper");
    const options = whisper?.options ?? [];
    expect(options).toHaveLength(MAX_PICTURES + 1);
    expect(options.slice(0, MAX_PICTURES).every((o) => o.type === ApplicationCommandOptionType.Attachment)).toBe(true);
    expect(options.map((o) => o.name)).toEqual([...WHISPER_OPTIONS, HELP_OPTION]);
  });

  it("gives every command and /lead subcommand an optional help, and nothing required", () => {
    for (const c of buildCommands({ ...all, siege: url })) {
      if (c.name === "help") continue;
      const holders = c.name === "lead" ? (c.options ?? []).map((s) => ("options" in s ? s.options ?? [] : [])) : [c.options ?? []];
      for (const options of holders) {
        expect(options.at(-1)).toMatchObject({ name: HELP_OPTION, type: ApplicationCommandOptionType.Boolean });
        expect(options.some((o) => o.required)).toBe(false);
      }
    }
  });

  it("lets /help pick a member command of the linked sheets, never /lead", () => {
    const help = buildCommands({ events: url }).find((c) => c.name === "help");
    const command = help?.options?.[0];
    expect(command && "choices" in command ? command.choices?.map((c) => c.value) : undefined).toEqual(["iam", "whisper", "overlay", "events", "ad", "elixir"]);
  });

  it("adds one member command per text of each linked sheet, and /lead last", () => {
    expect(buildCommands(all).map((c) => c.name)).toEqual([
      "iam", "whisper", "overlay", "farms", "player", "whois", "alliance", "schedule", "today", "rules", "driverguide", "events", "ad", "elixir", "kvk", "help", "lead",
    ]);
    expect(buildCommands({ events: url }).map((c) => c.name)).toEqual(["iam", "whisper", "overlay", "events", "ad", "elixir", "help", "lead"]);
  });

  it("puts /player with Alliance Statistics, where the cards come from", () => {
    expect(buildCommands({ coachman: url }).map((c) => c.name)).not.toContain("player");
    expect(buildCommands({ stats: url }).map((c) => c.name)).toContain("player");
  });

  it("gives member commands nothing to pick but help, and no option to post; /ad also an optional tomorrow", () => {
    const plain = buildCommands(all).filter((c) => !["iam", "whisper", "overlay", "player", "whois", "alliance", "lead", "ad", "help"].includes(c.name));
    expect(plain.map((c) => c.name)).toEqual(["farms", "schedule", "today", "rules", "driverguide", "events", "elixir", "kvk"]);
    for (const c of plain) {
      expect(c.options?.map((o) => o.name)).toEqual([HELP_OPTION]);
      expect(c.default_member_permissions ?? null).toBeNull();
    }
    const ad = buildCommands(all).find((c) => c.name === "ad");
    expect(ad?.options?.map((o) => [o.name, o.type, o.required ?? false])).toEqual([
      ["tomorrow", ApplicationCommandOptionType.Boolean, false],
      [HELP_OPTION, ApplicationCommandOptionType.Boolean, false],
    ]);
    const player = buildCommands(all).find((c) => c.name === "player");
    expect(player?.options?.map((o) => o.name)).toEqual(["name", HELP_OPTION]);
    const whois = buildCommands(all).find((c) => c.name === "whois");
    expect(whois?.options?.map((o) => o.name)).toEqual(["name", "uid", "kingdom", HELP_OPTION]);
    const alliance = buildCommands(all).find((c) => c.name === "alliance");
    expect(alliance?.options?.map((o) => o.name)).toEqual(["search", "kingdom", HELP_OPTION]);
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

describe("wantsHelp", () => {
  const o = (name: string, value: unknown = "x") => ({ name, value });

  it("shows the help when asked for", () => {
    expect(wantsHelp("schedule", [o(HELP_OPTION, true)])).toBe(true);
    expect(wantsHelp("iam", [o("name"), o(HELP_OPTION, true)])).toBe(true);
    expect(wantsHelp("lead driver", [o(HELP_OPTION, true)])).toBe(true);
    expect(wantsHelp("schedule", [o(HELP_OPTION, false)])).toBe(false);
    expect(wantsHelp("schedule", [])).toBe(false);
  });

  it("shows the help when something the command needs is missing", () => {
    expect(wantsHelp("iam", [])).toBe(true);
    expect(wantsHelp("iam", [o("name")])).toBe(false);
    expect(wantsHelp("player", [])).toBe(true);
    expect(wantsHelp("whois", [o("kingdom", 101)])).toBe(true);
    expect(wantsHelp("whois", [o("uid")])).toBe(false);
    expect(wantsHelp("whois", [o("name")])).toBe(false);
    expect(wantsHelp("alliance", [])).toBe(true);
    expect(wantsHelp("alliance", [o("search")])).toBe(false);
    expect(wantsHelp("whisper", [])).toBe(true);
    expect(wantsHelp("whisper", [o("picture3")])).toBe(false);
    expect(wantsHelp("lead link", [o("user")])).toBe(true);
    expect(wantsHelp("lead link", [o("user"), o("name")])).toBe(false);
    expect(wantsHelp("lead post", [])).toBe(true);
    expect(wantsHelp("lead vote", [o("which")])).toBe(false);
    expect(wantsHelp("overlay", [])).toBe(false);
  });
});
