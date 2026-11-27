import { createHash } from "node:crypto";
import type { SheetKey } from "../config.js";
import { memberHelp, type HelpEntry } from "../discord/help.js";

/**
 * The guide forum: a start post, one post per channel Carlos posts in by himself (the announcement channel, the upload
 * channel) and one per public command. Carlos posts them in
 * GUIDE_FORUM_ID and edits them whenever this file, the /help texts or an example picture changes, so the forum stays
 * in step with what Carlos can do. Officer features (/lead, the video inbox) are not explained here.
 *
 * Keep it current: a new member command shows up by itself (its /help entry), a new screenshot kind of Alliance Members
 * (REPORT_PROMPT in members/Inbox.js) needs an entry in SCREENSHOT_KINDS, and the test fails for a command no post explains.
 */

type Sheets = Readonly<Partial<Record<SheetKey, string>>>;

export interface GuideContext {
  readonly sheets: Sheets;
  readonly uploadChannelId: string;
  /** The announcement channel: invitation cards and votes. */
  readonly announceChannelId: string;
}

/** One message of a post: Markdown text and, below it, the example pictures named like `guide/<image>.png`. */
export interface GuidePart {
  readonly text: string;
  readonly image?: string;
}

export interface GuidePost {
  /** Stays the same for the life of the post: Carlos finds its thread by it. */
  readonly key: string;
  readonly title: string;
  /** Forum tags, applied when the forum has a tag of that name. */
  readonly tags: readonly string[];
  readonly parts: readonly GuidePart[];
}

export const MAX_MESSAGE = 2000;
export const MAX_TITLE = 100;

const FOOTER = "-# Questions? Ask any R4.";

export interface ScreenshotKind {
  /** As Alliance Members calls the kind (REPORT_PROMPT); also the name of its example pictures. */
  readonly key: string;
  /** The heading: the screen as the game names it. */
  readonly name: string;
  /** One line: where to find it and what to send. */
  readonly how: string;
  /** Screens with tabs: one message and one example picture (`<key>-1.png` ...) per tab, in this order. */
  readonly tabs?: readonly string[];
  /** A short line after the tabs, with its own example picture (`<image>.png`). */
  readonly note?: { readonly text: string; readonly image: string };
}

export const SCREENSHOT_GROUPS: readonly { key: string; title: string; kinds: readonly ScreenshotKind[] }[] = [
  {
    key: "shots-own",
    title: "What to screenshot: your own squads, heroes and soldiers",
    kinds: [
      { key: "squads", name: "Squad overview", how: "Triangular Arena (every second week): the screen with all your squads and their Squad Might." },
      { key: "hero", name: "Hero page", how: "Open a hero. Send the tabs **Stats**, **Stars** and **Skill**." },
      { key: "roster", name: "Hero list", how: "Hero screen, tab **All**. Scroll and send each part." },
      { key: "barracks", name: "Barracks", how: "The Barracks window with your soldiers per tier. Once a day it earns 5 points, more on the days of the combat readiness check (Day IV and Rest Day)." },
      { key: "epigraph", name: "Raven Epigraph", how: "Tap one epigraph: its info window." },
    ],
  },
  {
    key: "shots-battle",
    title: "What to screenshot: battle and scout reports (Mail)",
    kinds: [
      {
        key: "battle",
        name: "Battle report against a player",
        how: "Open the report in your Mail and send **every tab** in one post.",
        tabs: ["Overview", "Hero", "Lineup", "Battle Statistics"],
        note: {
          text: "Against a monster there is no Overview tab. No troops on the other side? Then there is no Lineup tab either.",
          image: "raid",
        },
      },
      { key: "pve", name: "Battle report against a monster", how: "Same as above, for a Blight or another monster." },
      { key: "scout", name: "Scout report", how: "The report with the scouted player's squads." },
      { key: "defense", name: "Defense Lineup (Arena)", how: "In the Arena, tap another player: the small window with their five heroes." },
    ],
  },
  {
    key: "shots-rank",
    title: "What to screenshot: rankings, campaign and Demon King",
    kinds: [
      { key: "arena", name: "Arena ranking", how: "Scroll and send several pictures for more players." },
      { key: "campaign", name: "Campaign result", how: "The Victory or Defeat screen of a stage." },
      { key: "bosslog", name: "Demon King Blight: Battle Log", how: "The Battle Log window of the daily Demon King." },
      { key: "bossrank", name: "Demon King Blight: DMG Rank", how: "The DMG Rank window of the Demon King." },
    ],
  },
];

/** Every kind the guide explains. */
export const SCREENSHOT_KINDS: readonly ScreenshotKind[] = SCREENSHOT_GROUPS.flatMap((g) => g.kinds);

/** Sections packed into as few messages as fit, in order; a section is never split. */
export function pack(sections: readonly string[], limit = MAX_MESSAGE): string[] {
  const out: string[] = [];
  for (const s of sections) {
    const last = out.length - 1;
    if (last >= 0 && out[last]!.length + 2 + s.length <= limit) out[last] += `\n\n${s}`;
    else out.push(s);
  }
  return out;
}

/** What a command post adds to the command's /help text: where it ties in with a channel. */
const COMMAND_NOTES: Readonly<Record<string, (ctx: GuideContext) => string>> = {
  iam: (ctx) => `Do this first: without it Carlos cannot tell whose screenshots arrive in <#${ctx.uploadChannelId}>.`,
  whisper: (ctx) => `Which screens Carlos can read: see the post about <#${ctx.uploadChannelId}>.`,
  rotation: (ctx) => `Each day Carlos also posts the caravan message in <#${ctx.announceChannelId}> and tags the driver.`,
};

/** One post per public command: what it does, examples, and how it ties in with a channel. */
function commandPost(e: HelpEntry, ctx: GuideContext): GuidePost {
  // "This list" says nothing outside /help itself
  const title = e.name === "help" ? "/help: every command and how it works" : `/${e.name}: ${e.summary}`;
  const examples = e.examples.map(([typed, does]) => `- \`${typed}\`: ${does}`).join("\n");
  const note = COMMAND_NOTES[e.name]?.(ctx);
  return {
    key: `cmd-${e.name}`,
    title: title.length <= MAX_TITLE ? title : `/${e.name}`,
    tags: ["Commands"],
    parts: [{ text: `# **/${e.name}**\n${e.details}\n\n${examples}${note ? `\n\n${note}` : ""}\n\n${FOOTER}` }],
  };
}

/** The posts for this server: only what Carlos offers here (sheets with a link). */
export function guidePosts(ctx: GuideContext): GuidePost[] {
  const upload = `<#${ctx.uploadChannelId}>`;
  const announce = `<#${ctx.announceChannelId}>`;
  const channels: GuidePost[] = [];

  // the announcement channel: everything Carlos posts there by himself
  const announced: string[] = [];
  if (ctx.sheets.coachman) {
    announced.push("## Coachman Express\nEvery day a caravan card, three hours before set-up: who drives, set-up and boarding in your own time with a countdown. The driver of the day is tagged.");
  }
  if (ctx.sheets.kvk) {
    announced.push(
      "## KvK vote\nBefore each Royal City battle on Day VI: press **Participate** or **Stay out**, or **Don't know yet** if you can't tell " +
        "yet. You can change it until Day VI " +
        "starts; please vote in game too, it shows your Might. Then Carlos posts who comes and how strong we are.",
    );
  }
  if (ctx.sheets.siege) {
    announced.push(
      "## Undead Siege\nBefore each siege: press **Participate**, or **Stay out** if your plans change. Shortly before the start " +
        "Carlos posts the defense plan. If you are mentioned, send your squads.",
    );
  }
  if (announced.length) {
    channels.push({
      key: "announce",
      title: "Event announcements: what Carlos posts there",
      tags: ["Channels"],
      parts: pack([`# ${announce}\nCarlos posts here by himself. Keep an eye on it.`, ...announced, FOOTER]).map((text) => ({ text })),
    });
  }

  // the upload channel: how to send, then every screen Carlos reads, with examples
  channels.push({
    key: "send",
    title: "Report inbox: send your screenshots",
    tags: ["Channels", "Screenshots"],
    parts: [
      {
        text:
          `# ${upload}\n` +
          "- Post up to **10 screenshots at once**. No text needed, no cropping.\n" +
          "- Carlos reads them for you, and the officers get the numbers. Every report earns **intel points**.\n" +
          "- Something went wrong? Press **Retry** under Carlos's answer.\n" +
          "- Private? Use **/whisper** instead.\n\n" +
          "Which screens, with an example of each:",
      },
      ...SCREENSHOT_GROUPS.flatMap((g): GuidePart[] => [
        { text: `## ${g.title.replace("What to screenshot: ", "").replace(/^./, (c) => c.toUpperCase())}` },
        ...g.kinds.flatMap((k): GuidePart[] => [
          { text: `### ${k.name}\n${k.how}`, ...(k.tabs ? {} : { image: k.key }) },
          ...(k.tabs ?? []).map((tab, t) => ({ text: `**Tab ${t + 1} of ${k.tabs!.length}: ${tab}**`, image: `${k.key}-${t + 1}` })),
          ...(k.note ? [{ text: k.note.text, image: k.note.image }] : []),
        ]),
      ]),
      { text: FOOTER },
    ],
  });

  const commands = memberHelp(ctx.sheets).map((e) => commandPost(e, ctx));
  const list = (posts: readonly GuidePost[]) => posts.map((p) => `- ${p.title}`).join("\n");
  const start: GuidePost = {
    key: "start",
    title: "Start here: what Carlos does for you",
    tags: ["Start here"],
    parts: pack([
      "# Start here\n" +
        "Carlos is our alliance bot.\n" +
        "1. Run **/iam** once with your in-game name.\n" +
        `2. Post game screenshots in ${upload}.\n` +
        "3. Type **/help** for all commands.",
      `**Channels:**\n${list(channels)}`,
      `**Commands:**\n${list(commands)}`,
      FOOTER,
    ]).map((text) => ({ text })),
  };
  return [start, ...channels, ...commands];
}

/** The fingerprint of a post and its pictures: a change of either makes Carlos edit the post. */
export function fingerprint(post: GuidePost, pictures: (image: string) => readonly { name: string; bytes: Uint8Array }[]): string {
  const h = createHash("sha256").update(JSON.stringify(post));
  for (const p of post.parts) {
    for (const pic of p.image ? pictures(p.image) : []) h.update(pic.name).update(pic.bytes);
  }
  return h.digest("hex");
}
