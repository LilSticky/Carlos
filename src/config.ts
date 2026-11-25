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
  readonly sheetSecret: string;
  readonly dataDir: string;
  /** The /exec links of the sheets whose Bot.js Carlos may ask; a sheet without a link has no commands. */
  readonly sheets: Readonly<Partial<Record<SheetKey, string>> & { members: string }>;
  /** Where Carlos posts the Undead Siege invitation and plan; without it (or SIEGE_URL) nothing is posted by itself. */
  readonly siegeChannelId?: string;
  /** Where R4 and R5 post screen recordings of rankings; without it Carlos reads no videos. */
  readonly videoChannelId?: string;
  /** The forum channel where Carlos keeps the guide posts up to date; without it there is no guide. */
  readonly guideForumId?: string;
}

export type SheetKey = "coachman" | "events" | "kvk" | "stats" | "members" | "siege";

/** The setting that holds each sheet's /exec link. */
export const SHEET_SETTINGS = {
  coachman: "COACHMAN_URL",
  events: "EVENTS_URL",
  kvk: "KVK_URL",
  stats: "STATS_URL",
  members: "MEMBERS_URL",
  siege: "SIEGE_URL",
} as const satisfies Record<SheetKey, string>;

const execLink = z
  .string()
  .trim()
  .regex(/^https:\/\/script\.google\.com\/\S+\/exec$/, "must be the /exec link of the sheet's web app");

const snowflake = z.string().trim().regex(/^\d{17,20}$/, "must be a Discord ID (17 to 20 digits)");

const schema = z.object({
  DISCORD_TOKEN: z.string().trim().min(1, "is missing"),
  DISCORD_APP_ID: snowflake,
  GUILD_ID: snowflake,
  UPLOAD_CHANNEL_ID: snowflake,
  SHEET_SECRET: z.string().trim().min(24, "must be the BOT_SECRET of the sheets' web apps (24 characters or more)"),
  DATA_DIR: z.string().trim().min(1).default("data"),
  COACHMAN_URL: execLink.optional(),
  EVENTS_URL: execLink.optional(),
  KVK_URL: execLink.optional(),
  STATS_URL: execLink.optional(),
  MEMBERS_URL: execLink,
  SIEGE_URL: execLink.optional(),
  SIEGE_CHANNEL_ID: snowflake.optional(),
  VIDEO_CHANNEL_ID: snowflake.optional(),
  GUIDE_FORUM_ID: snowflake.optional(),
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
  const sheets: Partial<Record<SheetKey, string>> = {};
  for (const key of Object.keys(SHEET_SETTINGS) as SheetKey[]) {
    const url = e[SHEET_SETTINGS[key]];
    if (url) sheets[key] = url;
  }
  return {
    discordToken: e.DISCORD_TOKEN,
    appId: e.DISCORD_APP_ID,
    guildId: e.GUILD_ID,
    uploadChannelId: e.UPLOAD_CHANNEL_ID,
    sheetSecret: e.SHEET_SECRET,
    dataDir: e.DATA_DIR,
    sheets: { ...sheets, members: e.MEMBERS_URL },
    ...(e.SIEGE_CHANNEL_ID ? { siegeChannelId: e.SIEGE_CHANNEL_ID } : {}),
    ...(e.VIDEO_CHANNEL_ID ? { videoChannelId: e.VIDEO_CHANNEL_ID } : {}),
    ...(e.GUIDE_FORUM_ID ? { guideForumId: e.GUIDE_FORUM_ID } : {}),
  };
}
