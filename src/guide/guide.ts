import { createHash } from "node:crypto";
import type { SheetKey } from "../config.js";
import { memberHelp, type HelpEntry } from "../discord/help.js";

/**
 * The guide forum: one forum post per topic that explains what Carlos does for members. Carlos posts them in
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
}

export const SCREENSHOT_GROUPS: readonly { key: string; title: string; kinds: readonly ScreenshotKind[] }[] = [
  {
    key: "shots-own",
    title: "What to screenshot: your own squads, heroes and soldiers",
    kinds: [
      { key: "squads", name: "Squad overview", how: "All your squads on one screen, with their Squad Might." },
      { key: "hero", name: "Hero page", how: "Open a hero. Send the tabs **Stats**, **Stars** and **Skill**." },
      { key: "roster", name: "Hero list", how: "Hero screen, tab **All**. Scroll and send each part." },
      { key: "barracks", name: "Barracks", how: "The Barracks window with your soldiers per tier." },
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
        how: "Open the report in your Mail and send **all 3 tabs** in one post.",
        tabs: ["Hero", "Lineup", "Battle Statistics"],
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

/** One line per command: name, what it does, one example. The details are in each command's help option. */
function commandLine(e: HelpEntry): string {
  const ex = e.examples[0];
  const typed = ex && ex[0] !== `/${e.name}` ? ` Example: \`${ex[0]}\`` : "";
  return `**/${e.name}**: ${e.summary}.${typed}`;
}

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

function commandPost(key: string, title: string, intro: string, entries: readonly HelpEntry[], tags: readonly string[]): GuidePost | undefined {
  if (!entries.length) return undefined;
  const parts = pack([`# ${title}\n${intro}`, entries.map(commandLine).join("\n"), FOOTER]).map((text) => ({ text }));
  return { key, title, tags, parts };
}

/** The posts for this server: only what Carlos offers here (sheets with a link). */
export function guidePosts(ctx: GuideContext): GuidePost[] {
  const help = memberHelp(ctx.sheets);
  const pick = (...names: string[]) => names.map((n) => help.find((e) => e.name === n)).filter((e): e is HelpEntry => !!e);
  const upload = `<#${ctx.uploadChannelId}>`;
  const posts: (GuidePost | undefined)[] = [];

  posts.push({
    key: "send",
    title: "How to send screenshots",
    tags: ["Screenshots"],
    parts: pack([
      "# How to send screenshots\n" +
        `- Post up to **10 screenshots at once** in ${upload}. No text needed, no cropping.\n` +
        "- Carlos reads them for you, and the officers get the numbers.\n" +
        "- Something went wrong? Press **Retry** under Carlos's answer.\n" +
        "- Which screens: see the **What to screenshot** posts.",
      pick("whisper", "overlay").map(commandLine).join("\n"),
      FOOTER,
    ]).map((text) => ({ text })),
  });

  for (const g of SCREENSHOT_GROUPS) {
    posts.push({
      key: g.key,
      title: g.title,
      tags: ["Screenshots"],
      parts: [
        { text: `# ${g.title}\nPost them in ${upload}. One example per screen below.` },
        ...g.kinds.flatMap((k): GuidePart[] => [
          { text: `## ${k.name}\n${k.how}`, ...(k.tabs ? {} : { image: k.key }) },
          ...(k.tabs ?? []).map((tab, t) => ({ text: `**Tab ${t + 1} of ${k.tabs!.length}: ${tab}**`, image: `${k.key}-${t + 1}` })),
        ]),
        { text: FOOTER },
      ],
    });
  }

  posts.push(
    commandPost("cards", "Player and alliance cards", "Look up any player or alliance.", pick("player", "whois", "alliance"), ["Commands"]),
    commandPost(
      "farms",
      "Farms: who to hit",
      "Carlos makes sure two of us never hit the same farm.",
      pick("farms"),
      ["Commands"],
    ),
    commandPost("faq", "FAQ: how to drive the coachman, house rules", "Only you see the answer.", pick("faq"), ["Commands"]),
  );

  if (ctx.sheets.kvk) {
    posts.push({
      key: "kvk-vote",
      title: "KvK: say if you make it to the battle",
      tags: ["Events"],
      parts: [
        {
          text:
            "# KvK: say if you make it to the battle\n" +
            `- Before each Royal City battle on Day VI Carlos posts a vote in <#${ctx.announceChannelId}>. Press **Participate** or **Stay out**.\n` +
            "- You can change your answer until Day VI starts. Your answer here counts over the in-game vote, but please vote in game too: it shows your Might.\n" +
            "- When Day VI starts the vote closes and Carlos posts the KvK Readiness card: who comes and how strong we are.\n\n" +
            FOOTER,
        },
      ],
    });
  }

  if (ctx.sheets.siege) {
    posts.push({
      key: "siege",
      title: "Undead Siege: sign up with one button",
      tags: ["Events"],
      parts: [
        {
          text:
            "# Undead Siege: sign up with one button\n" +
            `- Before each siege Carlos posts an invitation in <#${ctx.announceChannelId}>. Press **Participate**, or **Stay out** if your plans change.\n` +
            "- Shortly before the start Carlos posts the defense plan there. If you are mentioned, send your squads.\n\n" +
            FOOTER,
        },
      ],
    });
  }

  const others = posts.filter((p): p is GuidePost => !!p);
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
      `**The posts here:**\n${others.map((p) => `- ${p.title}`).join("\n")}`,
      FOOTER,
    ]).map((text) => ({ text })),
  };
  return [start, ...others];
}

/** The fingerprint of a post and its pictures: a change of either makes Carlos edit the post. */
export function fingerprint(post: GuidePost, pictures: (image: string) => readonly { name: string; bytes: Uint8Array }[]): string {
  const h = createHash("sha256").update(JSON.stringify(post));
  for (const p of post.parts) {
    for (const pic of p.image ? pictures(p.image) : []) h.update(pic.name).update(pic.bytes);
  }
  return h.digest("hex");
}
