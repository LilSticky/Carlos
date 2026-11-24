import { z } from "zod";
/** A setting is missing or wrong. Lists the setting names only, never their values. */
export class ConfigError extends Error {
    problems;
    constructor(problems) {
        super(`Carlos cannot start:\n- ${problems.join("\n- ")}`);
        this.problems = problems;
        this.name = "ConfigError";
    }
}
/** The setting that holds each sheet's /exec link. */
export const SHEET_SETTINGS = {
    coachman: "COACHMAN_URL",
    events: "EVENTS_URL",
    kvk: "KVK_URL",
    stats: "STATS_URL",
};
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
    SHEET_URL: z
        .string()
        .trim()
        .regex(/^https:\/\/script\.google\.com\/\S+\/exec$/, "must be the /exec link of the Alliance upload web app"),
    SHEET_SECRET: z.string().trim().min(24, "must be the BOT_SECRET of the upload web app (24 characters or more)"),
    DATA_DIR: z.string().trim().min(1).default("data"),
    COACHMAN_URL: execLink.optional(),
    EVENTS_URL: execLink.optional(),
    KVK_URL: execLink.optional(),
    STATS_URL: execLink.optional(),
});
export function readConfig(env) {
    const blankless = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ""));
    const parsed = schema.safeParse(blankless);
    if (!parsed.success) {
        throw new ConfigError(parsed.error.issues.map((issue) => {
            const name = String(issue.path[0] ?? "?");
            return issue.code === "invalid_type" ? `${name} is missing` : `${name} ${issue.message}`;
        }));
    }
    const e = parsed.data;
    const sheets = {};
    for (const key of Object.keys(SHEET_SETTINGS)) {
        const url = e[SHEET_SETTINGS[key]];
        if (url)
            sheets[key] = url;
    }
    return {
        discordToken: e.DISCORD_TOKEN,
        appId: e.DISCORD_APP_ID,
        guildId: e.GUILD_ID,
        uploadChannelId: e.UPLOAD_CHANNEL_ID,
        sheetUrl: e.SHEET_URL,
        sheetSecret: e.SHEET_SECRET,
        dataDir: e.DATA_DIR,
        sheets,
    };
}
//# sourceMappingURL=config.js.map