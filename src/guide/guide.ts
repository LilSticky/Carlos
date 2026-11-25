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
  /** Where the Undead Siege invitation goes; without it the siege post is left out. */
  readonly siegeChannelId?: string;
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

const FOOTER = "-# Carlos keeps this post up to date. Questions? Ask in the alliance channel or any R4.";

export interface ScreenshotKind {
  /** As Alliance Members calls the kind (REPORT_PROMPT); also the name of its example pictures. */
  readonly key: string;
  readonly name: string;
  /** Which screen, and how to take it. */
  readonly how: string;
  /** What it is good for. */
  readonly gives: string;
}

export const SCREENSHOT_GROUPS: readonly { key: string; title: string; intro: string; kinds: readonly ScreenshotKind[] }[] = [
  {
    key: "shots-own",
    title: "Screenshots: your squads, heroes and soldiers",
    intro:
      "These screens show your own account. Send them when something changed (a new hero, a star up, new gear), " +
      "so the officers plan with your real strength and not last month's.",
    kinds: [
      {
        key: "squads",
        name: "Squad overview",
        how: "The overview of your squads: up to four squads with their number, Squad Might and five heroes each. Your name and total Might at the top right help Carlos.",
        gives: "Your squads and their Might for the squad import and your combat card (**/player**).",
      },
      {
        key: "hero",
        name: "Hero page",
        how: "Open one of your heroes. Screenshot the tabs **Stats**, **Stars** and **Skill**: the three pictures of the same hero count as one. Several heroes in one post are fine.",
        gives: "Level, stars, gear and skills of the hero on your combat card.",
      },
      {
        key: "roster",
        name: "Hero list",
        how: "The **Hero** screen, tab **All**. Scroll down and take a picture of each part; overlapping pictures are fine, Carlos counts a hero only once.",
        gives: "Which heroes you have and which squad each one is in.",
      },
      {
        key: "barracks",
        name: "Barracks",
        how: "The **Barracks** window: total soldier count, the soldiers inside the territory per tier and those outside.",
        gives: "Your soldiers per tier, kept over time, so the officers see your troops grow.",
      },
      {
        key: "epigraph",
        name: "Raven Epigraph",
        how: "The info window of one Raven Epigraph: its name, Might, slot and effect.",
        gives: "Which epigraph you have, for the Lineup of your squads.",
      },
    ],
  },
  {
    key: "shots-battle",
    title: "Screenshots: battle and scout reports",
    intro:
      "Reports from your Mail tell us how strong other players really are. Every report you send makes the " +
      "combat cards (**/player**) of our enemies more exact.",
    kinds: [
      {
        key: "battle",
        name: "Battle report",
        how:
          "A battle against another player, from your Mail. Send **every tab**: Overview, Hero, Lineup and Battle " +
          "Statistics. Pictures with the same Battle Report ID (at the bottom) count as one battle, so send all tabs in one post.",
        gives: "Both sides' squads, heroes, gear and losses: intel on the other player and a record of the fight.",
      },
      {
        key: "pve",
        name: "Battle report against a monster",
        how: "The same report, but against a Blight (Wandering, Elite, resource or Demon King Blight), a thief or another monster.",
        gives: "Your damage and losses against monsters.",
      },
      {
        key: "scout",
        name: "Scout report",
        how: "A scout report (Scout or Scouted) with the squads of the scouted player.",
        gives: "The scouted player's squads on their combat card.",
      },
      {
        key: "defense",
        name: "Defense lineup",
        how: "In the Arena, tap another player: the small **Defense Lineup** window with their name, power and five heroes.",
        gives: "That player's heroes on their combat card. Works in any game language.",
      },
    ],
  },
  {
    key: "shots-rank",
    title: "Screenshots: rankings, campaign and Demon King",
    intro: "Rankings and results show where you and others stand. Carlos reads the whole list, not only your row.",
    kinds: [
      {
        key: "arena",
        name: "Arena ranking",
        how: "The ranking of the Arena of Fate or the Triangular Arena. Scroll and send several pictures for more players.",
        gives: "Rank, power and arena points of every player on the list.",
      },
      {
        key: "campaign",
        name: "Campaign result",
        how: "The Victory or Defeat screen of a campaign stage (with Current Stage and your five heroes), or its statistics window with damage, damage taken and healing.",
        gives: "How far you are in the campaign and how your heroes did.",
      },
      {
        key: "bosslog",
        name: "Demon King Blight: Battle Log",
        how: "The **Battle Log** of the daily Demon King Blight: your highest damage and the last 10 attempts.",
        gives: "Your damage against the Demon King and the heroes you used.",
      },
      {
        key: "bossrank",
        name: "Demon King Blight: DMG Rank",
        how: "The **DMG Rank** window of the Demon King Blight.",
        gives: "The damage of every player on the list.",
      },
    ],
  },
];

/** Every kind the guide explains. */
export const SCREENSHOT_KINDS: readonly ScreenshotKind[] = SCREENSHOT_GROUPS.flatMap((g) => g.kinds);

function commandSection(e: HelpEntry): string {
  const examples = e.examples.map(([typed, does]) => `- \`${typed}\`: ${does}`).join("\n");
  return `### /${e.name}\n${e.summary}.\n\n${e.details}\n\n${examples}`;
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
  const parts = pack([intro, ...entries.map(commandSection), FOOTER]).map((text) => ({ text }));
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
        "Screenshots are how the alliance knows our strength and our enemies'. You take them in the game, Carlos does " +
        "the typing: an AI reads every picture and the results land in the officers' sheets.",
      "## In short\n" +
        `- Post up to **10 screenshots at once** in ${upload}. No text needed.\n` +
        "- Carlos answers with a thanks; the pictures are read within the next minutes.\n" +
        "- Private? Use **/whisper**: nobody in the channel sees the pictures.\n" +
        "- Something went wrong? Press **Retry** under Carlos's answer.\n" +
        "- Which screens Carlos can read: see the three **Screenshots:** posts in this forum.",
      ...pick("whisper", "overlay").map(commandSection),
      "## Questions\n" +
        "**Do I need to crop or mark anything?** No. Send the whole screen as the game shows it.\n" +
        "**Can I send screens in another game language?** Yes, but the numbers must be readable.\n" +
        "**I sent the same report twice.** No problem: the same battle is stored only once.",
      FOOTER,
    ]).map((text) => ({ text })),
  });

  for (const g of SCREENSHOT_GROUPS) {
    posts.push({
      key: g.key,
      title: g.title,
      tags: ["Screenshots"],
      parts: [
        { text: `# ${g.title.replace("Screenshots: ", "").replace(/^./, (c) => c.toUpperCase())}\n${g.intro}\n\n${g.kinds.map((k) => `- ${k.name}`).join("\n")}\n\nPost them in ${upload}. Each screen with an example below.` },
        ...g.kinds.map((k, i) => ({
          text: `## ${k.name}\n**What to take:** ${k.how}\n**What it is good for:** ${k.gives}${i === g.kinds.length - 1 ? `\n\n${FOOTER}` : ""}`,
          image: k.key,
        })),
      ],
    });
  }

  posts.push(
    commandPost(
      "cards",
      "Player and alliance cards",
      "# Player and alliance cards\nWho is that, how strong are they, and where do they sit? Three commands answer it, " +
        "for everyone in the channel. AD scores and donations are never shown to other members.",
      pick("player", "whois", "alliance"),
      ["Commands"],
    ),
    commandPost(
      "farms",
      "Farms: who to hit",
      "# Farms\nFarms are players without an alliance tag who sit on lots of resources. Carlos keeps the list and makes " +
        "sure two of us never hit the same farm at once.",
      pick("farms"),
      ["Commands"],
    ),
    commandPost(
      "texts",
      "Coachman, events and KvK in Discord",
      "# Coachman, events and KvK\nThe alliance's plans, straight from the officers' sheets. Every command shows the " +
        "current version for everyone in the channel. Coachman: our daily caravan; one member drives, others guard.",
      pick("schedule", "today", "rules", "driverguide", "events", "ad", "elixir", "kvk"),
      ["Commands"],
    ),
  );

  if (ctx.sheets.siege && ctx.siegeChannelId) {
    posts.push({
      key: "siege",
      title: "Undead Siege: sign up with one button",
      tags: ["Events"],
      parts: pack([
        "# Undead Siege\n" +
          `Before each Undead Siege Carlos posts an invitation in <#${ctx.siegeChannelId}>. One press and your spare ` +
          "squads are part of the defense plan.",
        "## In short\n" +
          "- Press **Participate** under the invitation. Link your account with **/iam** first.\n" +
          "- Shortly before the start Carlos posts the defense plan in the same channel.\n" +
          "- If your squads are needed, Carlos mentions you in the plan. Check it before the siege starts.",
        FOOTER,
      ]).map((text) => ({ text })),
    });
  }

  const others = posts.filter((p): p is GuidePost => !!p);
  const start: GuidePost = {
    key: "start",
    title: "Start here: what Carlos does for you",
    tags: ["Start here"],
    parts: pack([
      "# Carlos, the Alliance Attendant\n" +
        "Carlos is our alliance's bot. Carlos takes your screenshots to the officers and shows player cards and the " +
        "alliance's plans right here in Discord, so you need fewer trips to the spreadsheets. Each post in this forum " +
        "explains one part.",
      "## In short\n" +
        "- Tell Carlos once who you are in the game: **/iam**.\n" +
        `- Post screenshots from the game in ${upload}. Carlos reads them, you don't fill in anything.\n` +
        "- Type **/** in any channel to see Carlos's commands, or **/help** for the list. Add **help: True** to any " +
        "command to see how it works.",
      ...pick("iam").map(commandSection),
      `## The posts in this forum\n${others.map((p) => `- **${p.title}**`).join("\n")}`,
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
