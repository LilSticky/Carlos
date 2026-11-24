import { describe, expect, it } from "vitest";
import { ConfigError, readConfig } from "./config.js";

const good = {
  DISCORD_TOKEN: "token",
  DISCORD_APP_ID: "123456789012345678",
  GUILD_ID: "223456789012345678",
  UPLOAD_CHANNEL_ID: "323456789012345678",
  SHEET_URL: "https://script.google.com/macros/s/AKfy-abc_123/exec",
  SHEET_SECRET: "a-secret-that-is-long-enough",
};

describe("readConfig", () => {
  it("reads every setting and defaults the data folder", () => {
    expect(readConfig(good)).toEqual({
      discordToken: "token",
      appId: "123456789012345678",
      guildId: "223456789012345678",
      uploadChannelId: "323456789012345678",
      sheetUrl: "https://script.google.com/macros/s/AKfy-abc_123/exec",
      sheetSecret: "a-secret-that-is-long-enough",
      dataDir: "data",
      sheets: {},
    });
  });

  it("keeps the links of the sheets that have one", () => {
    const url = "https://script.google.com/macros/s/AKfy-kvk/exec";
    expect(readConfig({ ...good, KVK_URL: url, STATS_URL: " " }).sheets).toEqual({ kvk: url });
    expect(() => readConfig({ ...good, EVENTS_URL: "https://example.com" })).toThrow(/EVENTS_URL must be the \/exec link/);
  });

  it("names every missing or wrong setting, without its value", () => {
    let error: unknown;
    try {
      readConfig({ ...good, DISCORD_TOKEN: " ", SHEET_URL: "https://example.com/exec", SHEET_SECRET: "short-secret" });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const problems = (error as ConfigError).problems;
    expect(problems).toEqual([
      "DISCORD_TOKEN is missing",
      "SHEET_URL must be the /exec link of the Alliance upload web app",
      "SHEET_SECRET must be the BOT_SECRET of the upload web app (24 characters or more)",
    ]);
    expect((error as Error).message).not.toContain("short-secret");
  });

  it("refuses an ID that is not a Discord ID", () => {
    expect(() => readConfig({ ...good, GUILD_ID: "my server" })).toThrow(/GUILD_ID must be a Discord ID/);
  });
});
