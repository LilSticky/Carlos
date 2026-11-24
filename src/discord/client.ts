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
import { buildCommands, leadText, memberText, WHISPER_OPTIONS } from "./commands.js";
import { exportText, iamText, linkText, uploadText } from "./texts.js";

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
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (interaction.guildId !== w.config.guildId) return;
    if (interaction.isAutocomplete()) void autocomplete(interaction, w);
    else if (interaction.isStringSelectMenu() && interaction.customId === CARD_MENU) {
      void pickCard(interaction, w).catch((e: unknown) => w.log(`Card menu failed: ${String(e)}`));
    } else if (interaction.isStringSelectMenu() && interaction.customId === FARM_MENU) {
      void pickFarm(interaction, w).catch((e: unknown) => w.log(`Farm menu failed: ${String(e)}`));
    } else if (interaction.isButton() && interaction.customId.startsWith(RETRACE)) {
      void retrace(interaction, w).catch((e: unknown) => w.log(`Retrace failed: ${String(e)}`));
    } else if (interaction.isChatInputCommand()) {
      void command(interaction, w).catch(async (e: unknown) => {
        w.log(`/${interaction.commandName} failed: ${String(e)}`);
        await interaction.editReply("Something went wrong. Please try again.").catch(() => undefined);
      });
    }
  });

  client.on(Events.MessageCreate, (message) => {
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

async function command(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const name = interaction.commandName;
  if (name === "iam") {
    const outcome = await claimName(interaction.user.id, interaction.options.getString("name", true), w.iam);
    if (outcome.kind === "linked") w.log(`${interaction.user.id} is ${outcome.member} (/iam).`);
    await interaction.editReply(iamText(outcome, w.config.uploadChannelId));
  } else if (name === "whisper") {
    await whisper(interaction, w);
  } else if (name === "farms") {
    await farms(interaction, w);
  } else if (name === "player") {
    await player(interaction, w);
  } else if (name === "lead") {
    await lead(interaction, w);
  } else {
    const text = memberText(name, interaction.options.getBoolean("tomorrow") ?? false);
    if (text) await showText(interaction, text, false, officerCheck(interaction, w), w);
  }
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

/** Asks Alliance Members for one farm action; the answer, or the error text to show. */
async function farmCall<T>(action: string, args: Record<string, unknown>, read: (raw: unknown) => T | undefined, w: Wiring): Promise<T | string> {
  try {
    const answer = read(await w.callSheet("members", action, args));
    if (answer) return answer;
    w.log(`Farms ${action}: Alliance Members sent an answer Carlos cannot read.`);
    return "The sheet sent an answer Carlos cannot read.";
  } catch (e) {
    if (e instanceof SheetError && e.setup) w.log(`Farms ${action}: ${e.message}`);
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

/** /farms: the farms without an alliance tag, seen only by the asker, with the menu to pick one. */
async function farms(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  const list = await farmCall("farms", {}, readFarmList, w);
  if (typeof list === "string") {
    await interaction.editReply(list);
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
  const farm = await farmCall("hit", { key: interaction.values[0] ?? "", by: member }, readHit, w);
  const list = await farmCall("farms", {}, readFarmList, w);
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
  const r = await farmCall("retrace", { key }, readRetrace, w);
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

/** /player: the combat card of a member or of a player seen in reports, seen only by the asker. */
async function player(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  const query = interaction.options.getString("name", true).trim();
  const card = await fetchCard(query, w);
  if (typeof card === "string") {
    await interaction.editReply(card);
    return;
  }
  if (!card.player) {
    await interaction.editReply(`No player found for **${query}**: not on the member list and not seen in any report.`);
    return;
  }
  await interaction.editReply({ ...cardMessage(card, true), allowedMentions: NO_PINGS });
}

/** The menu under a card: shows the picked player's card in the same (private) message. */
async function pickCard(interaction: StringSelectMenuInteraction, w: Wiring): Promise<void> {
  await interaction.deferUpdate();
  const card = await fetchCard(interaction.values[0] ?? "", w);
  if (typeof card === "string" || !card.player) {
    await interaction.followUp({ content: typeof card === "string" ? card : "That player is gone from the sheets.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.editReply({ ...cardMessage(card, true), allowedMentions: NO_PINGS });
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

/** Shows a text to the asker, or posts it in the channel (officers only, checked by runExport). */
async function showText(
  interaction: ChatInputCommandInteraction,
  key: TextKey,
  post: boolean,
  isOfficer: () => Promise<boolean>,
  w: Wiring,
): Promise<void> {
  const def = TEXTS[key];
  const outcome = await runExport(def, { post, isOfficer }, w.callSheet);
  if (outcome.kind === "failed" && outcome.setup) w.log(`/${interaction.commandName} ${def.key}: ${outcome.error}`);
  if (outcome.kind === "shown" && post) w.log(`${def.key} posted by ${interaction.user.id}.`);
  await interaction.editReply(exportText(outcome));
  if (outcome.kind !== "shown") return;
  // posted: plain text for everyone; shown to the asker: in-game texts in code blocks, easy to copy into the game
  const messages = toMessages(outcome.parts, !post && !def.discord);
  for (const content of messages) {
    await interaction.followUp(post ? { content, allowedMentions: NO_PINGS } : { content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
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

async function upload(message: Message, w: Wiring): Promise<void> {
  const working = await message.react("⏳").catch(() => undefined);
  const outcome = await sendUpload(
    {
      authorId: message.author.id,
      messageId: message.id,
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
  const text = uploadText(outcome);
  if (!text) return;
  await message.react(outcome.kind === "sent" ? "✅" : "❌").catch(() => undefined);
  await message.reply({ content: text, allowedMentions: { repliedUser: outcome.kind !== "sent" } });
}
