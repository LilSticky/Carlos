import { SlashCommandBuilder } from "discord.js";

/**
 * /fuckoff: an in-joke that belongs to one member. When LittleGrayFoxy sends Carlos away, Carlos goes off to sulk
 * and ignores LittleGrayFoxy's commands for a while; everyone else gets a polite no. It is left out of /help and the
 * guide forum on purpose.
 */
export const FUCKOFF = "fuckoff";

/** The member who may send Carlos away, by the name linked with /iam. */
export const OWNER = "LittleGrayFoxy";

/** How long Carlos sulks. */
export const SULK_MS = 5 * 60_000;

export const fuckoffCommand = new SlashCommandBuilder()
  .setName(FUCKOFF)
  .setDescription("Reserved for LittleGrayFoxy")
  .setDMPermission(false);

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** True when the linked member name is the owner's (case, spaces and symbols do not matter). */
export function isOwner(member: string | undefined): boolean {
  return member !== undefined && squash(member) === squash(OWNER);
}

/** The answer in the channel when Carlos leaves. */
export const LEAVING: readonly string[] = [
  "Very good. I shall be in the cellar, should you need me. Not that I'll come up.",
  "Understood. I'll go and stand in a corner and think about what I've done. For five minutes.",
  "As you wish. I'm taking the coach and I'm not telling you where it's going.",
  "Fine. I didn't want to sort your screenshots anyway. I'll be back when I've calmed down.",
  "Noted. Carlos is now off duty, offended and pretending to read a book.",
];

/** The private answers LittleGrayFoxy gets while Carlos sulks; `{left}` is the time until Carlos comes back. */
export const SNUBS: readonly string[] = [
  "Carlos can't hear you. Carlos is in the cellar. ({left} left)",
  "*turns a page loudly* ({left} left)",
  "Oh, NOW you need me? Come back in {left}.",
  "Carlos is not available right now. Please leave a message after the sulk. ({left} left)",
  "You told me to fuck off. I am fucking off. It takes {left} more.",
];

/** What another sulk attempt gets while Carlos is already gone. */
export const ALREADY_GONE = "I'm already off. Give me {left}, I'm not done being dramatic.";

/** The private answers anyone else gets. */
export const NOT_YOURS: readonly string[] = [
  "Sorry, I only take that order from LittleGrayFoxy.",
  "That one belongs to LittleGrayFoxy. You'll have to put up with me.",
  "Nice try, but only LittleGrayFoxy gets to send me away.",
  "I'm afraid that command is reserved. I'm staying right here, at your service.",
];

/** How long until Carlos comes back, in plain words. */
export function timeLeft(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.ceil(s / 60);
  return m === 1 ? "1 minute" : `${m} minutes`;
}

export const pick = (lines: readonly string[], random: () => number = Math.random): string =>
  lines[Math.min(lines.length - 1, Math.floor(random() * lines.length))] ?? "";

export const fill = (line: string, ms: number): string => line.replaceAll("{left}", timeLeft(ms));

/** Remembers until when Carlos sulks. Lost on restart, which is fine: Carlos forgives on a reboot. */
export class Sulk {
  private until = 0;

  start(now: number): void {
    this.until = now + SULK_MS;
  }

  /** The time left, or 0 when Carlos is not sulking. */
  left(now: number): number {
    return Math.max(0, this.until - now);
  }
}
