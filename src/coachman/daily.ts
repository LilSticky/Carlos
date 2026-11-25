import { z } from "zod";

/**
 * The daily caravan post: the Coachman Express's chat message for the next stop (BotActions.js, action "daily"),
 * posted once a day in the announcement channel some hours before set-up, without @here. The driver is mentioned
 * when their Discord account is linked to their name.
 */
const answer = z.object({
  text: z.string().min(1),
  /** The day of the stop, yyyy-mm-dd: one post per day. */
  day: z.string().min(1),
  coach: z.string().catch(""),
  fromAt: z.number(),
  byAt: z.number(),
});
export type Daily = z.infer<typeof answer>;

export function readDaily(raw: unknown): Daily | undefined {
  const r = answer.safeParse(raw);
  return r.success ? r.data : undefined;
}

/** How long before set-up starts the post goes out. */
export const DAILY_LEAD_MS = 3 * 3600_000;

/** True when the day's post is due: from DAILY_LEAD_MS before set-up until boarding, and not posted yet. */
export function dailyDue(daily: Daily, posted: boolean, now: Date): boolean {
  const t = now.getTime();
  return !posted && t >= daily.fromAt - DAILY_LEAD_MS && t < daily.byAt;
}

/** The post: the chat message as it is, and the driver mentioned when linked. */
export function dailyMessage(daily: Daily, driverId: string | undefined): { content: string; users: string[] } {
  return driverId
    ? { content: `${daily.text}\nDriver: <@${driverId}>`, users: [driverId] }
    : { content: daily.text, users: [] };
}
