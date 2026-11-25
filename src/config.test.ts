import { describe, expect, it } from "vitest";
import { ConfigError, readConfig } from "./config.js";

const good = {
  DISCORD_TOKEN: "token",
  DISCORD_APP_ID: "123456789012345678",
  GUILD_ID: "223456789012345678",
  UPLOAD_CHANNEL_ID: "323456789012345678",
  MEMBERS_URL: "https://script.google.com/macros/s/AKfy-abc_123/exec",
  SHEET_SECRET: "a-secret-that-is-long-enough",
};

describe("readConfig", () => {
  it("reads every setting and defaults the data folder", () => {
    expect(readConfig(good)).toEqual({
      discordToken: "token",
      appId: "123456789012345678",
      guildId: "223456789012345678",
      uploadChannelId: "323456789012345678",
      sheetSecret: "a-secret-that-is-long-enough",
      dataDir: "data",
      sheets: { members: "https://script.google.com/macros/s/AKfy-abc_123/exec" },
      announceChannelId: "1575230778902716446",
    });
  });

  it("posts announcements in the announcement channel, not in the old siege channel", () => {
    expect(readConfig({ ...good, SIEGE_CHANNEL_ID: "523456789012345678" }).announceChannelId).toBe("1575230778902716446");
    expect(readConfig({ ...good, ANNOUNCE_CHANNEL_ID: "623456789012345678" }).announceChannelId).toBe("623456789012345678");
  });

  it("keeps the links of the sheets that have one", () => {
    const url = "https://script.google.com/macros/s/AKfy-kvk/exec";
    expect(readConfig({ ...good, KVK_URL: url, STATS_URL: " " }).sheets).toEqual({ kvk: url, members: good.MEMBERS_URL });
    expect(() => readConfig({ ...good, EVENTS_URL: "https://example.com" })).toThrow(/EVENTS_URL must be the \/exec link/);
  });

  it("keeps the video channel when set", () => {
    expect(readConfig({ ...good, VIDEO_CHANNEL_ID: "423456789012345678" }).videoChannelId).toBe("423456789012345678");
    expect(readConfig(good).videoChannelId).toBeUndefined();
  });

  it("names every missing or wrong setting, without its value", () => {
    let error: unknown;
    try {
      readConfig({ ...good, DISCORD_TOKEN: " ", MEMBERS_URL: "https://example.com/exec", SHEET_SECRET: "short-secret" });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const problems = (error as ConfigError).problems;
    expect(problems).toEqual([
      "DISCORD_TOKEN is missing",
      "SHEET_SECRET must be the BOT_SECRET of the sheets' web apps (24 characters or more)",
      "MEMBERS_URL must be the /exec link of the sheet's web app",
    ]);
    expect((error as Error).message).not.toContain("short-secret");
  });

  it("refuses an ID that is not a Discord ID", () => {
    expect(() => readConfig({ ...good, GUILD_ID: "my server" })).toThrow(/GUILD_ID must be a Discord ID/);
  });
});
