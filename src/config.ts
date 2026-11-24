import { z } from "zod";

/** A setting is missing or wrong. Lists the setting names only, never their values. */
export class ConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Carlos cannot start:\n- ${problems.join("\n- ")}`);
    this.name = "ConfigError";
  }
}

export interface Config {
  readonly discordToken: string;
  readonly appId: string;
  readonly guildId: string;
  readonly uploadChannelId: string;
  readonly sheetUrl: string;
  readonly sheetSecret: string;
  readonly dataDir: string;
}

const snowflake = z.string().trim().regex(/^\d{17,20}$/, "must be a Discord ID (17 to 20 digits)");

const schema = z.object({
  DISCORD_TOKEN: z.string().trim().min(1, "is missing"),
  DISCORD_APP_ID: snowflake,
  GUILD_ID: snowflake,
  UPLOAD_CHANNEL_ID: snowflake,
  SHEET_URL: z
    .string()
    .trim()
    .regex(/^https:\/\/script\.google\.com\/\S+\/exec$/, "must be the /exec link of the Alliance upload web app"),
  SHEET_SECRET: z.string().trim().min(24, "must be the BOT_SECRET of the upload web app (24 characters or more)"),
  DATA_DIR: z.string().trim().min(1).default("data"),
});

export function readConfig(env: Readonly<Record<string, string | undefined>>): Config {
  const blankless = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ""));
  const parsed = schema.safeParse(blankless);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => {
        const name = String(issue.path[0] ?? "?");
        return issue.code === "invalid_type" ? `${name} is missing` : `${name} ${issue.message}`;
      }),
    );
  }
  const e = parsed.data;
  return {
    discordToken: e.DISCORD_TOKEN,
    appId: e.DISCORD_APP_ID,
    guildId: e.GUILD_ID,
    uploadChannelId: e.UPLOAD_CHANNEL_ID,
    sheetUrl: e.SHEET_URL,
    sheetSecret: e.SHEET_SECRET,
    dataDir: e.DATA_DIR,
  };
}
