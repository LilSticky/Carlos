import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  StringSelectMenuBuilder,
  type APIEmbed,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Message,
  type StringSelectMenuInteraction,
} from "discord.js";
import { cardEmbeds, readCard, sideLabel, type CardAnswer } from "../cards/card.js";
import { suggestPeople, type PeopleList } from "../cards/people.js";
import { readStats, statsEmbeds } from "../cards/stats.js";
import type { Config } from "../config.js";
import { runExport, TEXTS, toMessages, type CallSheet, type TextKey } from "../exports/exports.js";
import { farmCard, farmOptions, farmsText, readFarmList, readHit, readRetrace, type FarmList } from "../farms/farms.js";
import { assignName, claimName, type IamDeps } from "../members/iam.js";
import { suggestMembers, type MemberList } from "../members/members.js";
import { SheetError } from "../sheet/sheet.js";
import type { UploadDeps } from "../uploads/upload.js";
import { sendUpload } from "../uploads/upload.js";
import { buildCommands, faqText, leadText, WHISPER_OPTIONS, wantsHelp } from "./commands.js";
import { findHelp, helpDetails, helpOverview } from "./help.js";
import { canRetryUpload, exportText, iamText, linkText, overlayText, uploadText } from "./texts.js";
import { overlayKey } from "../overlay/overlay.js";
import { SIEGE_BUTTON, SIEGE_LEAVE } from "../siege/siege.js";
import { KVK_NO, KVK_YES } from "../kvk/kvk.js";
import { kvkButton, startKvkBoard, type KvkDeps } from "./kvk-board.js";
import { announce, HERE } from "./announce.js";
import { siegeButton, siegeNow, startSiegeBoard, type SiegeDeps } from "./siege-board.js";
import {
  allianceEmbed,
  allianceNotFoundText,
  ambiguousText,
  matchOptions,
  playerArgs,
  playerEmbed,
  playerNotFoundText,
  readAllianceAnswer,
  readPlayerAnswer,
  rosterOptions,
  type AllianceAnswer,
  type PlayerAnswer,
} from "../tracker/tracker.js";
import { syncGuide, type GuideDeps } from "./guide-forum.js";
import { catchUpVideos, VIDEO_MENU, videoMenu, videoPost, type VideoDeps } from "./video-inbox.js";

export interface Wiring {
  readonly config: Config;
  readonly memberList: MemberList;
  /** Members and players seen in reports, for /player's autocomplete. */
  readonly people: PeopleList;
  readonly iam: IamDeps;
  readonly upload: UploadDeps;
  /** Asks a sheet's Bot.js; only sheets with a link in the config. */
  readonly callSheet: CallSheet;
  /** True when the Discord account is linked to an R4 or R5 of the member list. */
  readonly isOfficer: (discordId: string) => Promise<boolean>;
  /** The Undead Siege: invitation, Participate and Stay out, plan; only with SIEGE_URL. */
  readonly siege?: SiegeDeps;
  /** The KvK vote card and the KvK Readiness card; only with KVK_URL. */
  readonly kvk?: KvkDeps;
  /** The video inbox: ranking recordings of R4 and R5; only with VIDEO_CHANNEL_ID. */
  readonly video?: VideoDeps;
  /** The guide forum: posts explaining Carlos, edited when they change; only with GUIDE_FORUM_ID. */
  readonly guide?: GuideDeps;
  readonly log: (line: string) => void;
}

const NO_PINGS = { parse: [] as never[] };

/**
 * Logs in, registers the slash commands on the alliance server (guild commands show up at once) and answers them,
 * plus screenshots posted in the upload channel. Reading attachments needs the Message Content intent, switched on
 * in the developer portal (Bot > Privileged Gateway Intents).
 */
export async function connect(w: Wiring): Promise<Client> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  client.once(Events.ClientReady, (ready) => {
    w.log(`Carlos is online as ${ready.user.tag}.`);
    void w.memberList.fresh().catch((e: unknown) => w.log(`Member list not loaded: ${String(e)}`));
    // the boards post by themselves in the announcement channel (ANNOUNCE_CHANNEL_ID)
    if (w.siege?.channelId) startSiegeBoard(ready, w.siege);
    if (w.kvk?.channelId) startKvkBoard(ready, w.kvk);
    if (w.guide) void syncGuide(ready, w.guide).catch((e: unknown) => w.log(`Guide forum not updated: ${String(e)}`));
    if (w.video) void catchUpVideos(ready, w.video).catch((e: unknown) => w.log(`Video inbox catch-up failed: ${String(e)}`));
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.guildId !== w.config.guildId) return;
    if (interaction.isAutocomplete()) void autocomplete(interaction, w);
    else if (interaction.isStringSelectMenu() && interaction.customId === CARD_MENU) {
      void pickCard(interaction, w).catch((e: unknown) => w.log(`Card menu failed: ${String(e)}`));
    } else if (interaction.isStringSelectMenu() && (interaction.customId === WHOIS_PICK || interaction.customId === WHOIS_ROSTER)) {
      void pickWhois(interaction, w).catch((e: unknown) => w.log(`Whois menu failed: ${String(e)}`));
    } else if (interaction.isStringSelectMenu() && interaction.customId === FARM_MENU) {
      void pickFarm(interaction, w).catch((e: unknown) => w.log(`Farm menu failed: ${String(e)}`));
    } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith(VIDEO_MENU) && w.video) {
      void videoMenu(interaction, w.video).catch((e: unknown) => w.log(`Video menu failed: ${String(e)}`));
    } else if (interaction.isButton() && interaction.customId.startsWith(RETRACE)) {
      void retrace(interaction, w).catch((e: unknown) => w.log(`Retrace failed: ${String(e)}`));
    } else if (interaction.isButton() && (interaction.customId.startsWith(KVK_YES) || interaction.customId.startsWith(KVK_NO)) && w.kvk) {
      void kvkButton(interaction, w.kvk).catch((e: unknown) => w.log(`KvK answer failed: ${String(e)}`));
    } else if (interaction.isButton() && (interaction.customId.startsWith(SIEGE_BUTTON) || interaction.customId.startsWith(SIEGE_LEAVE)) && w.siege) {
      void siegeButton(interaction, w.siege).catch((e: unknown) => w.log(`Siege sign-up failed: ${String(e)}`));
    } else if (interaction.isButton() && interaction.customId.startsWith(RETRY_UPLOAD)) {
      void retryUpload(interaction, w).catch((e: unknown) => w.log(`Upload retry failed: ${String(e)}`));
    } else if (interaction.isChatInputCommand()) {
      void command(interaction, w).catch(async (e: unknown) => {
        w.log(`/${interaction.commandName} failed: ${String(e)}`);
        await fail(interaction, "Something went wrong. Please try again.").catch(() => undefined);
      });
    }
  });

  client.on(Events.MessageCreate, (message) => {
    if (w.video && !message.author.bot && message.guildId === w.config.guildId && message.channelId === w.video.channelId) {
      if (message.attachments.size) void videoPost(message, w.video).catch((e: unknown) => w.log(`Video ${message.id} failed: ${String(e)}`));
      return;
    }
    if (message.author.bot || message.guildId !== w.config.guildId || message.channelId !== w.config.uploadChannelId) return;
    if (!message.attachments.size) return;
    void upload(message, w).catch((e: unknown) => w.log(`Upload ${message.id} failed: ${String(e)}`));
  });

  const rest = new REST().setToken(w.config.discordToken);
  await rest.put(Routes.applicationGuildCommands(w.config.appId, w.config.guildId), { body: buildCommands(w.config.sheets) });
  await client.login(w.config.discordToken);
  return client;
}

async function autocomplete(interaction: AutocompleteInteraction, w: Wiring): Promise<void> {
  // Discord gives 3 seconds: answer from the cached list and refresh it in the background
  const typed = String(interaction.options.getFocused());
  if (interaction.commandName === "player") {
    await interaction.respond(suggestPeople(w.people.peek(), typed)).catch(() => undefined);
    return;
  }
  const cached = w.memberList.peek();
  void w.memberList.names().catch(() => undefined);
  await interaction
    .respond(suggestMembers(cached, typed).map((n) => ({ name: n, value: n })))
    .catch(() => undefined);
}

/** Commands whose answer only the asker sees: linking, private screenshots, overlay keys and leadership. */
const PRIVATE_COMMANDS: ReadonlySet<string> = new Set(["iam", "whisper", "overlay", "faq", "lead"]);

/**
 * Shows an error or refusal only to the asker. A public answer's placeholder is removed first, so the channel
 * never keeps a failed command.
 */
async function fail(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
  if (interaction.ephemeral) {
    await interaction.editReply({ content, allowedMentions: NO_PINGS });
    return;
  }
  await interaction.deleteReply().catch(() => undefined);
  await interaction.followUp({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
}

async function command(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  const name = interaction.commandName;
  if (name === "help") {
    await help(interaction, w);
    return;
  }
  const sub = interaction.options.getSubcommand(false);
  const key = sub ? `${name} ${sub}` : name;
  const given = sub ? (interaction.options.data[0]?.options ?? []) : interaction.options.data;
  const entry = wantsHelp(key, given) ? findHelp(key) : undefined;
  if (entry) {
    await interaction.reply({ embeds: [helpDetails(entry)], flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    return;
  }
  // member commands that only show alliance texts or cards answer in the channel for everyone
  await interaction.deferReply(PRIVATE_COMMANDS.has(name) ? { flags: MessageFlags.Ephemeral } : {});
  if (name === "iam") {
    const outcome = await claimName(interaction.user.id, interaction.options.getString("name", true), w.iam);
    if (outcome.kind === "linked") w.log(`${interaction.user.id} is ${outcome.member} (/iam).`);
    await interaction.editReply(iamText(outcome, w.config.uploadChannelId));
  } else if (name === "whisper") {
    await whisper(interaction, w);
  } else if (name === "overlay") {
    const outcome = await overlayKey(interaction.user.id, interaction.options.getBoolean("off") ?? false, {
      memberOf: (id) => w.upload.memberOf(id),
      callSheet: w.callSheet,
      membersUrl: w.config.sheets.members,
    });
    if (outcome.kind === "key" || outcome.kind === "revoked") w.log(`/overlay ${outcome.kind} for ${outcome.member}.`);
    if (outcome.kind === "failed") w.log(`/overlay ${interaction.user.id}: ${outcome.error}`);
    await interaction.editReply(overlayText(outcome));
  } else if (name === "farms") {
    await farms(interaction, w);
  } else if (name === "player") {
    await player(interaction, w);
  } else if (name === "whois") {
    await whois(interaction, w);
  } else if (name === "alliance") {
    await alliance(interaction, w);
  } else if (name === "lead") {
    await lead(interaction, w);
  } else if (name === "rotation") {
    await showText(interaction, "schedule", false, officerCheck(interaction, w), w, false);
  } else if (name === "faq") {
    const text = faqText(interaction.options.getString("topic"));
    if (text) await showText(interaction, text, false, officerCheck(interaction, w), w, false);
    else await interaction.editReply("Pick one of the offered topics.");
  }
}

/** /help: one command in detail, or all of them; the /lead part only for R4 and R5. Only the asker sees it. */
async function help(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const entry = findHelp(interaction.options.getString("command") ?? "");
  const embed = entry ? helpDetails(entry) : helpOverview(w.config.sheets, await officerCheck(interaction, w)());
  await interaction.editReply({ embeds: [embed], allowedMentions: NO_PINGS });
}

/** Asks once per command whether the asker is an R4 or R5. */
function officerCheck(interaction: ChatInputCommandInteraction, w: Wiring): () => Promise<boolean> {
  let officer: Promise<boolean> | undefined;
  return () => (officer ??= w.isOfficer(interaction.user.id).catch(() => false));
}

/** /lead: only for R4 and R5 on the member list, whoever Discord shows it to. */
async function lead(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  const isOfficer = officerCheck(interaction, w);
  if (!(await isOfficer())) {
    await interaction.editReply(exportText({ kind: "officers-only" }));
    return;
  }
  const sub = interaction.options.getSubcommand();
  if (sub === "link") {
    const user = interaction.options.getUser("user", true);
    const outcome = await assignName(user.id, interaction.options.getString("name", true), w.iam);
    if (outcome.kind === "linked") w.log(`${user.id} is ${outcome.member} (/lead link by ${interaction.user.id}).`);
    await interaction.editReply(linkText(outcome, user.id));
  } else if (sub === "stats") {
    await stats(interaction, w);
  } else if (sub === "siege" && w.siege) {
    await siegeNow(interaction, w.siege);
  } else {
    const text = leadText(sub, interaction.options.getString("what") ?? interaction.options.getString("which"));
    if (!text) {
      await interaction.editReply("Pick one of the offered texts.");
      return;
    }
    await showText(interaction, text, sub === "post", isOfficer, w);
  }
}

const FARM_MENU = "farm";
const RETRACE = "retrace:";

/** Asks Alliance Members for one action (farms, tracker lookups); the answer, or the error text to show. */
async function membersCall<T>(action: string, args: Record<string, unknown>, read: (raw: unknown) => T | undefined, w: Wiring): Promise<T | string> {
  try {
    const answer = read(await w.callSheet("members", action, args));
    if (answer) return answer;
    w.log(`Alliance Members ${action}: sent an answer Carlos cannot read.`);
    return "The sheet sent an answer Carlos cannot read.";
  } catch (e) {
    if (e instanceof SheetError && e.setup) w.log(`Alliance Members ${action}: ${e.message}`);
    return e instanceof SheetError ? e.message : "Something went wrong. Please try again.";
  }
}

/** The list and, while any farm is ready, the menu to pick the one you attack. */
function farmsMessage(list: FarmList): { content: string; components: ActionRowBuilder<StringSelectMenuBuilder>[] } {
  const options = farmOptions(list);
  const components = options.length
    ? [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId(FARM_MENU).setPlaceholder("I attack this farm now").addOptions(options),
        ),
      ]
    : [];
  return { content: toMessages([farmsText(list)], false)[0] ?? "", components };
}

/** The Gone? Retrace button under a farm (the farm's key rides in the button). */
function retraceRow(key: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId((RETRACE + key).slice(0, 100)).setLabel("Gone? Retrace").setStyle(ButtonStyle.Secondary),
  );
}

/** /farms: the farms without an alliance tag, for everyone in the channel, with the menu to pick one. */
async function farms(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  const list = await membersCall("farms", {}, readFarmList, w);
  if (typeof list === "string") {
    await fail(interaction, list);
    return;
  }
  await interaction.editReply({ ...farmsMessage(list), allowedMentions: NO_PINGS });
}

/**
 * The menu under /farms: the asker attacks that farm now. It goes on cooldown under their member name (so others
 * pick another), the list is redrawn, and a message with the farm and its Retrace button follows.
 */
async function pickFarm(interaction: StringSelectMenuInteraction, w: Wiring): Promise<void> {
  const member = w.upload.memberOf(interaction.user.id);
  if (!member) {
    await interaction.reply({ content: "Who are you in the game? Tell me once with **/iam**, then pick the farm again.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferUpdate();
  const farm = await membersCall("hit", { key: interaction.values[0] ?? "", by: member }, readHit, w);
  const list = await membersCall("farms", {}, readFarmList, w);
  if (typeof list !== "string") await interaction.editReply({ ...farmsMessage(list), allowedMentions: NO_PINGS });
  if (typeof farm === "string") {
    await interaction.followUp({ content: farm, flags: MessageFlags.Ephemeral });
    return;
  }
  w.log(`Farm ${farm.key} hit by ${member}.`);
  await interaction.followUp({
    content: farmCard(farm, `Go! **${farm.player}** is yours.`),
    components: [retraceRow(farm.key)],
    flags: MessageFlags.Ephemeral,
    allowedMentions: NO_PINGS,
  });
}

/** Gone? Retrace: the tracker looks the player up live; the message shows where the farm went. */
async function retrace(interaction: ButtonInteraction, w: Wiring): Promise<void> {
  await interaction.deferUpdate();
  const key = interaction.customId.slice(RETRACE.length);
  const r = await membersCall("retrace", { key }, readRetrace, w);
  if (typeof r === "string") {
    await interaction.followUp({ content: r, flags: MessageFlags.Ephemeral });
    return;
  }
  w.log(`Farm ${key} retraced by ${interaction.user.id}: ${r.outcome}.`);
  await interaction.editReply({
    content: farmCard(r.farm, r.text),
    components: r.outcome === "tagged" ? [] : [retraceRow(r.farm.key)],
    allowedMentions: NO_PINGS,
  });
}

const CARD_MENU = "card";

/** Asks Alliance Statistics for a card; the error text when it cannot. */
async function fetchCard(query: string, w: Wiring): Promise<CardAnswer | string> {
  try {
    const card = readCard(await w.callSheet("stats", "card", { query }));
    if (card) return card;
    w.log("/player: Alliance Statistics sent a card Carlos cannot read.");
    return "The sheet sent an answer Carlos cannot read.";
  } catch (e) {
    if (e instanceof SheetError && e.setup) w.log(`/player: ${e.message}`);
    return e instanceof SheetError ? e.message : "Something went wrong. Please try again.";
  }
}

/** The card's embeds, and a menu to switch to the other matches (only on the asker's own copy). */
function cardMessage(card: CardAnswer, withMenu: boolean): { embeds: APIEmbed[]; components: ActionRowBuilder<StringSelectMenuBuilder>[] } {
  const others = card.matches.filter((m) => m.name !== card.player?.name).slice(0, 25);
  const components =
    withMenu && others.length
      ? [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(CARD_MENU)
              .setPlaceholder(`${others.length} more found: show another`)
              .addOptions(others.map((m) => ({ label: m.name.slice(0, 100), value: m.name.slice(0, 100), description: sideLabel(m).slice(0, 100) }))),
          ),
        ]
      : [];
  return { embeds: cardEmbeds(card), components };
}

/** /player: the combat card of a member or of a player seen in reports, for everyone in the channel. */
async function player(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  const query = interaction.options.getString("name", true).trim();
  const card = await fetchCard(query, w);
  if (typeof card === "string") {
    await fail(interaction, card);
    return;
  }
  if (!card.player) {
    await fail(interaction, `No player found for **${query}**: not on the member list and not seen in any report.`);
    return;
  }
  await interaction.editReply({ ...cardMessage(card, true), allowedMentions: NO_PINGS });
}

/**
 * The menu under a card: the one who asked for the card switches it in place; anyone else gets the picked card
 * only for themselves, so a shared card never changes under its asker.
 */
async function pickCard(interaction: StringSelectMenuInteraction, w: Wiring): Promise<void> {
  const own = interaction.message.interactionMetadata?.user.id === interaction.user.id || interaction.message.flags.has(MessageFlags.Ephemeral);
  if (own) await interaction.deferUpdate();
  else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const card = await fetchCard(interaction.values[0] ?? "", w);
  if (typeof card === "string" || !card.player) {
    const content = typeof card === "string" ? card : "That player is gone from the sheets.";
    if (own) await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    else await interaction.editReply(content);
    return;
  }
  await interaction.editReply({ ...cardMessage(card, true), allowedMentions: NO_PINGS });
}

const WHOIS_PICK = "whois:pick";
const WHOIS_ROSTER = "whois:roster";

/** One select menu row. */
function menuRow(id: string, placeholder: string, options: { label: string; value: string; description: string }[]): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).addOptions(options),
  );
}

/** A player card, or the pick list when several share the name, or the text why there is none. */
function whoisMessage(answer: PlayerAnswer, args: Record<string, string>): { embeds: APIEmbed[]; components: ActionRowBuilder<StringSelectMenuBuilder>[]; content?: string } | string {
  if (answer.kind === "found") return { embeds: [playerEmbed(answer.player)], components: [] };
  if (answer.kind === "not-found" || !answer.matches.length) return playerNotFoundText(args);
  return {
    content: ambiguousText(args.name ?? "", answer.matches),
    embeds: [],
    components: [menuRow(WHOIS_PICK, "Pick the player", matchOptions(answer.matches))],
  };
}

/** /whois: a player from the tracker (through Alliance Members, which holds the key), for everyone in the channel. */
async function whois(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  const args = playerArgs({
    uid: interaction.options.getString("uid") ?? undefined,
    name: interaction.options.getString("name") ?? undefined,
    kingdom: interaction.options.getInteger("kingdom") ?? undefined,
  });
  if (!args) {
    await fail(interaction, "Give the player's complete name or uid.");
    return;
  }
  const answer = await membersCall("trackerPlayer", args, readPlayerAnswer, w);
  const message = typeof answer === "string" ? answer : whoisMessage(answer, args);
  if (typeof message === "string") {
    await fail(interaction, message);
    return;
  }
  await interaction.editReply({ ...message, allowedMentions: NO_PINGS });
}

/** /alliance: an alliance with its roster from the tracker, and a menu to look a member up. */
async function alliance(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  const search = (interaction.options.getString("search") ?? "").trim();
  const kingdom = interaction.options.getInteger("kingdom");
  const answer: AllianceAnswer | string = await membersCall("trackerAlliance", kingdom ? { search, kingdom: String(kingdom) } : { search }, readAllianceAnswer, w);
  if (typeof answer === "string" || answer.kind === "not-found") {
    await fail(interaction, typeof answer === "string" ? answer : allianceNotFoundText(search, answer.kingdom));
    return;
  }
  const options = rosterOptions(answer.alliance);
  const more = answer.alliance.roster.length > options.length ? ` (the first ${options.length})` : "";
  await interaction.editReply({
    embeds: [allianceEmbed(answer.alliance)],
    components: options.length ? [menuRow(WHOIS_ROSTER, `Look up a member${more}`, options)] : [],
    allowedMentions: NO_PINGS,
  });
}

/**
 * The menus of /whois and /alliance: the picked player's card. The asker of a /whois pick list gets it in place of
 * the list; a member picked under an alliance card, or a pick by someone else, comes only to the one who picked.
 */
async function pickWhois(interaction: StringSelectMenuInteraction, w: Wiring): Promise<void> {
  const own =
    interaction.customId === WHOIS_PICK &&
    (interaction.message.interactionMetadata?.user.id === interaction.user.id || interaction.message.flags.has(MessageFlags.Ephemeral));
  if (own) await interaction.deferUpdate();
  else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const args = { uid: interaction.values[0] ?? "" };
  const answer = await membersCall("trackerPlayer", args, readPlayerAnswer, w);
  const message = typeof answer === "string" ? answer : whoisMessage(answer, args);
  if (typeof message === "string") {
    if (own) await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral });
    else await interaction.editReply(message);
    return;
  }
  await interaction.editReply({ content: "", ...message, allowedMentions: NO_PINGS });
}

/** /lead stats: a member's full statistics as tables, seen only by the asker (lead() checked the rank). */
async function stats(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  const name = interaction.options.getString("name", true).trim();
  let raw: unknown;
  try {
    raw = await w.callSheet("stats", "stats", { name });
  } catch (e) {
    if (e instanceof SheetError && e.setup) w.log(`/lead stats: ${e.message}`);
    await interaction.editReply(e instanceof SheetError ? e.message : "Something went wrong. Please try again.");
    return;
  }
  const answer = readStats(raw);
  if (!answer) {
    w.log("/lead stats: Alliance Statistics sent an answer Carlos cannot read.");
    await interaction.editReply("The sheet sent an answer Carlos cannot read.");
    return;
  }
  w.log(`/lead stats ${answer.name} by ${interaction.user.id}.`);
  await interaction.editReply({ embeds: statsEmbeds(answer), allowedMentions: NO_PINGS });
}

/**
 * Shows a text to the asker, or posts it in the channel (officers only, checked by runExport). `codeBlock`: in-game
 * chat texts shown to copy go into code blocks; /faq shows its reference texts as plain text to read.
 */
async function showText(
  interaction: ChatInputCommandInteraction,
  key: TextKey,
  post: boolean,
  isOfficer: () => Promise<boolean>,
  w: Wiring,
  codeBlock = !post && !TEXTS[key].discord,
): Promise<void> {
  const def = TEXTS[key];
  const outcome = await runExport(def, { post, isOfficer }, w.callSheet);
  if (outcome.kind === "failed" && outcome.setup) w.log(`/${interaction.commandName} ${def.key}: ${outcome.error}`);
  if (outcome.kind === "shown" && post) w.log(`${def.key} posted by ${interaction.user.id}.`);
  if (outcome.kind !== "shown") {
    await fail(interaction, exportText(outcome));
    return;
  }
  const channelId = w.config.announceChannelId;
  if (post && channelId) {
    // announcements go to the announcement channel with @here, wherever /lead post was typed
    const [first = "", ...rest] = toMessages(outcome.parts, codeBlock, 2000 - HERE.length - 1);
    await announce(interaction.client, channelId, { content: `${HERE}\n${first}` }, true);
    for (const content of rest) await announce(interaction.client, channelId, { content }, false);
    await interaction.editReply(`${exportText(outcome)} In <#${channelId}>.`);
    return;
  }
  await interaction.editReply(exportText(outcome));
  // follow-ups are seen by whoever saw the first message (a /lead or /faq answer stays with the asker)
  const quiet = !post && interaction.ephemeral === true;
  const messages = toMessages(outcome.parts, codeBlock);
  for (const content of messages) {
    await interaction.followUp(quiet ? { content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS } : { content, allowedMentions: NO_PINGS });
  }
}

/** The first message as the deferred reply, the rest as follow-ups, all only for the asker. */
async function send(interaction: ChatInputCommandInteraction, messages: readonly string[]): Promise<void> {
  const [first, ...rest] = messages;
  await interaction.editReply({ content: first ?? "Nothing to show.", allowedMentions: NO_PINGS });
  for (const content of rest) await interaction.followUp({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
}

/** Like a post in the upload channel, but the pictures and Carlos's answer are seen only by the sender. */
async function whisper(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  const attachments = WHISPER_OPTIONS.flatMap((name) => {
    const a = interaction.options.getAttachment(name);
    return a ? [{ url: a.url, name: a.name, contentType: a.contentType, size: a.size }] : [];
  });
  const outcome = await sendUpload({ authorId: interaction.user.id, messageId: interaction.id, attachments }, w.upload);
  if (outcome.kind === "failed" && outcome.setup) w.log(`/whisper ${interaction.id}: ${outcome.error}`);
  await interaction.editReply({
    content: uploadText(outcome) ?? "None of these files is a screenshot. Nothing was sent.",
    allowedMentions: NO_PINGS,
  });
}

const RETRY_UPLOAD = "upload-retry:";

/** The Retry button under a failed upload's reply (the post's ID rides in the button). */
function retryRow(messageId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(RETRY_UPLOAD + messageId).setLabel("Retry").setStyle(ButtonStyle.Primary),
  );
}

/**
 * Sends the pictures of a post in the upload channel. `uploadKey` makes the upload ID: the post's own ID the first
 * time, the button press's ID on a retry, so a retry never adds its pictures to a half-sent first try.
 */
async function sendPost(message: Message, uploadKey: string, w: Wiring) {
  const working = await message.react("⏳").catch(() => undefined);
  const outcome = await sendUpload(
    {
      authorId: message.author.id,
      messageId: uploadKey,
      attachments: [...message.attachments.values()].map((a) => ({
        url: a.url,
        name: a.name,
        contentType: a.contentType,
        size: a.size,
      })),
    },
    w.upload,
  );
  await working?.users.remove(message.client.user.id).catch(() => undefined);
  if (outcome.kind === "failed" && outcome.setup) w.log(`Upload ${message.id}: ${outcome.error}`);
  return outcome;
}

async function upload(message: Message, w: Wiring): Promise<void> {
  const outcome = await sendPost(message, message.id, w);
  const retry = canRetryUpload(outcome);
  const text = uploadText(outcome, retry);
  if (!text) return;
  await message.react(outcome.kind === "sent" ? "✅" : "❌").catch(() => undefined);
  await message.reply({
    content: text,
    components: retry ? [retryRow(message.id)] : [],
    allowedMentions: { repliedUser: outcome.kind !== "sent" },
  });
}

/** Retry under a failed upload: only its sender may press it; the same pictures go again, the reply shows how. */
async function retryUpload(interaction: ButtonInteraction, w: Wiring): Promise<void> {
  const postId = interaction.customId.slice(RETRY_UPLOAD.length);
  const post = await interaction.channel?.messages.fetch(postId).catch(() => undefined);
  if (!post) {
    await interaction.update({ content: "The screenshots' post is gone. Post them again.", components: [] });
    return;
  }
  if (post.author.id !== interaction.user.id) {
    await interaction.reply({ content: "Only the one who posted these screenshots can retry.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferUpdate();
  const outcome = await sendPost(post, interaction.id, w);
  const retry = canRetryUpload(outcome);
  const sent = outcome.kind === "sent";
  if (sent) {
    await post.reactions.cache.get("❌")?.users.remove(post.client.user.id).catch(() => undefined);
    await post.react("✅").catch(() => undefined);
  }
  await interaction.editReply({
    content: uploadText(outcome, retry) ?? "None of these files is a screenshot. Nothing was sent.",
    components: retry ? [retryRow(post.id)] : [],
    allowedMentions: NO_PINGS,
  });
}
