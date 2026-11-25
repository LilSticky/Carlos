import type { APIEmbed } from "discord.js";
import type { SheetKey } from "../config.js";
import { MEMBER_TEXTS, TEXTS } from "../exports/exports.js";

/**
 * /help and the `help` option every command has: what each command is for, in plain words, with examples.
 * Only the commands of linked sheets are explained; the /lead part only to R4 and R5.
 */

type Sheets = Readonly<Partial<Record<SheetKey, string>>>;

export interface HelpEntry {
  /** The command as typed: "iam", or "lead post" for a /lead subcommand. */
  readonly name: string;
  /** One line for the overview. */
  readonly summary: string;
  /** What it does, who sees the answer, what to know. */
  readonly details: string;
  /** What to type, and what happens then. */
  readonly examples: readonly (readonly [string, string])[];
  /** Offered only with a link to this sheet; none: always. */
  readonly sheet?: SheetKey;
}

const ALSO_HELP = "Add **help: True** to any command to see how it works.";

export const MEMBER_HELP: readonly HelpEntry[] = [
  {
    name: "iam",
    summary: "Tell Carlos who you are in the game (once)",
    details:
      "Links your Discord account to your name on the alliance member list. Do it once: after that your screenshots go " +
      "under your name, **/overlay** can make your key and **/farms** knows who hit a farm. Pick your name from the " +
      "suggestions while you type. Only you see the answer. Not on the list? Ask an officer to add you first.",
    examples: [
      ["/iam name: Sam", "You are Sam from now on."],
      ["/iam name: sa", "Type part of your name and pick it from the list Discord shows."],
    ],
  },
  {
    name: "whisper",
    summary: "Send screenshots privately to the officers",
    details:
      "Sends up to 10 screenshots to the Upload Inbox, like a post in the upload channel, but nobody else in the " +
      "channel sees them or Carlos's answer. Use it for anything you do not want to show to everyone. Tell Carlos " +
      "who you are with **/iam** first.",
    examples: [
      ["/whisper picture: (your screenshot)", "Sends one screenshot."],
      ["/whisper picture: ... picture2: ... picture3: ...", "Sends several at once, up to picture10."],
    ],
  },
  {
    name: "overlay",
    summary: "Your key for the overlay app (screenshots from the game)",
    details:
      "The overlay app puts a button over the game that sends a screenshot straight to the officers. **/overlay** gives " +
      "you your personal connect code: paste it into the app once. A new code turns your old one off. Only you see " +
      "it; keep it to yourself, because it sends screenshots under your name.",
    examples: [
      ["/overlay", "Makes a new key for you."],
      ["/overlay off: True", "Turns your key off, for example when you lost your phone."],
    ],
  },
  {
    name: "farms",
    sheet: "members",
    summary: "Players without an alliance tag with lots of resources",
    details:
      "Lists farms: players without an alliance tag worth attacking. Pick the one you attack from the menu: it goes on " +
      "cooldown under your name, so nobody else hits it at the same time, and Carlos shows where it is. Not there any " +
      "more? Press **Gone? Retrace** and the tracker looks for where it went.",
    examples: [["/farms", "Shows the list. Pick a farm below it before you attack."]],
  },
  {
    name: "player",
    sheet: "stats",
    summary: "A player's combat card",
    details:
      "Shows the combat card of a player: Might, readiness, squads, heroes, gear and what battle reports showed. Works " +
      "for our members and for players of other alliances seen in reports. Type part of the name and pick from the " +
      "suggestions. Everyone in the channel sees the card; it never shows AD scores or donations.",
    examples: [
      ["/player name: Sam", "Sam's combat card."],
      ["/player name: sa", "Pick from the names that contain \"sa\"."],
    ],
  },
  {
    name: "whois",
    sheet: "members",
    summary: "Any player of the game, from the tracker",
    details:
      "Looks a player up on the Last Asylum Tracker: Might, Sanctuary level, kills, alliance and rank, and where they " +
      "sit on the map. Works for every player in every Kingdom. Give the complete name as in the game (the tracker has " +
      "no partial match) or the uid from the profile; add the Kingdom when several players share a name. The tracker " +
      "only knows what the map showed when someone last pressed Update Map, so the card says when that was. Everyone in " +
      "the channel sees the card.",
    examples: [
      ["/whois name: Sam", "Sam's card. Several players called Sam? Pick the one you mean."],
      ["/whois name: Sam kingdom: 101", "Only the Sam of Kingdom 101."],
      ["/whois uid: 12345678", "The player with that uid."],
    ],
  },
  {
    name: "alliance",
    sheet: "members",
    summary: "An alliance and its members, from the tracker",
    details:
      "Looks an alliance up on the Last Asylum Tracker: Might, level, leader and its members by rank. Give the tag or " +
      "the complete name; without a Kingdom Carlos looks in ours. Pick a member from the menu under the card to see " +
      "their player card, only for you. Everyone in the channel sees the alliance card.",
    examples: [
      ["/alliance search: ABC", "The alliance [ABC] in our Kingdom."],
      ["/alliance search: ABC kingdom: 101", "The alliance [ABC] in Kingdom 101."],
    ],
  },
  {
    name: "faq",
    sheet: TEXTS.driverguide.sheet,
    summary: "Look something up: how to drive the coachman, the house rules",
    details: "Shows a guide from the officers' sheets, only to you. Pick the topic from the list.",
    examples: [
      ["/faq topic: Driver guide", "What to do when it is your turn to drive."],
      ["/faq topic: House rules", "The rules of the coachman rotation."],
    ],
  },
  {
    name: "help",
    summary: "This list",
    details: "Shows all commands with one line each. Pick a command to see how it works with examples.",
    examples: [
      ["/help", "All commands."],
      ["/help command: farms", "How /farms works."],
      ["/farms help: True", "The same, from the command itself."],
    ],
  },
];

const POSTABLE = MEMBER_TEXTS.map((k) => TEXTS[k].label.toLowerCase()).join(", ");

export const LEAD_HELP: readonly HelpEntry[] = [
  {
    name: "lead text",
    summary: "A message for the alliance, only to you, to copy into the game",
    details:
      `Shows one of the alliance messages only to you, in a box that copies cleanly into the game chat: ${POSTABLE}. ` +
      "Showing the weekly schedule while it is still a draft does not lock it in.",
    examples: [
      ["/lead text what: Daily chat message", "Today's coachman message, to copy."],
      ["/lead text what: AD notice: tomorrow", "Tomorrow's Alliance Duel notice, to copy."],
    ],
  },
  {
    name: "lead post",
    summary: "Post an alliance message in this channel for everyone",
    details:
      `Posts one of the alliance messages in this channel, for everyone to read: ${POSTABLE}. ` +
      "Posting the weekly schedule locks it in.",
    examples: [
      ["/lead post what: Weekly schedule", "Posts the schedule and locks it in."],
      ["/lead post what: KvK roster", "Posts who comes to the KvK battle."],
    ],
  },
  {
    name: "lead link",
    summary: "Set which member a Discord account is",
    details:
      "Links a Discord account to a name on the member list, like **/iam** but for someone else. Use it when a member " +
      "picked the wrong name or their name is already taken by another account.",
    examples: [["/lead link user: @Sam name: Sam", "@Sam is Sam on the member list from now on."]],
  },
  {
    name: "lead driver",
    sheet: "coachman",
    summary: "The driver reminder to send on",
    details: "Shows the driver reminder, only to you, ready to send on to the driver.",
    examples: [["/lead driver", "The reminder, to copy."]],
  },
  {
    name: "lead notice",
    sheet: "coachman",
    summary: "The nominee notice",
    details: "Shows the nominee notice, only to you, ready to send on.",
    examples: [["/lead notice", "The notice, to copy."]],
  },
  {
    name: "lead siege",
    sheet: "siege",
    summary: "Make the Undead Siege defense plan now",
    details:
      "Makes the Undead Siege defense plan from who pressed **Participate** and posts it in this channel. Carlos also " +
      "posts the invitation and the plan by itself in the siege channel; use this when you need the plan earlier.",
    examples: [["/lead siege", "The plan, posted here."]],
  },
  {
    name: "lead vote",
    sheet: "stats",
    summary: "A vote list to send on",
    details: "Shows a vote list, only to you: the special nominations or the guard vote.",
    examples: [
      ["/lead vote which: Special nomination vote", "The nominee vote."],
      ["/lead vote which: Guard vote", "The guard vote."],
    ],
  },
  {
    name: "lead stats",
    sheet: "stats",
    summary: "All numbers of one member",
    details:
      "Shows a member's full statistics, only to you: AD scores, donations, tracker and duties. Members only ever see " +
      "their own numbers.",
    examples: [["/lead stats name: Sam", "Sam's numbers."]],
  },
];

const offered = (e: HelpEntry, sheets: Sheets): boolean => !e.sheet || Boolean(sheets[e.sheet]);

/** The member commands /help explains on this server. */
export function memberHelp(sheets: Sheets): HelpEntry[] {
  return MEMBER_HELP.filter((e) => offered(e, sheets));
}

/** The /lead subcommands on this server (text and post need at least one linked text). */
export function leadHelp(sheets: Sheets): HelpEntry[] {
  const texts = MEMBER_TEXTS.some((k) => sheets[TEXTS[k].sheet]);
  return LEAD_HELP.filter((e) => offered(e, sheets) && (!["lead text", "lead post"].includes(e.name) || texts));
}

/** The help entry of a command, "lead post" for a subcommand. */
export function findHelp(name: string): HelpEntry | undefined {
  return [...MEMBER_HELP, ...LEAD_HELP].find((e) => e.name === name);
}

const line = (e: HelpEntry) => `**/${e.name}**: ${e.summary}`;

/** /help: every command in one line; officers also get the /lead part. */
export function helpOverview(sheets: Sheets, officer: boolean): APIEmbed {
  const fields = [{ name: "Commands", value: memberHelp(sheets).map(line).join("\n") }];
  if (officer) fields.push({ name: "Officers (R4 and R5)", value: leadHelp(sheets).map(line).join("\n") });
  return {
    title: "What Carlos can do",
    description: `${ALSO_HELP} Or pick one with **/help command**.`,
    fields,
  };
}

/** The detailed help of one command, with examples. */
export function helpDetails(entry: HelpEntry): APIEmbed {
  return {
    title: `/${entry.name}`,
    description: `${entry.summary}.\n\n${entry.details}`,
    fields: [{ name: "Examples", value: entry.examples.map(([typed, does]) => `\`${typed}\`\n${does}`).join("\n\n") }],
  };
}
