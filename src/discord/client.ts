import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";
import type { Config } from "../config.js";
import { assignName, claimName, type IamDeps } from "../members/iam.js";
import { suggestMembers, type MemberList } from "../members/members.js";
import type { UploadDeps } from "../uploads/upload.js";
import { sendUpload } from "../uploads/upload.js";
import { commands } from "./commands.js";
import { iamText, linkText, uploadText } from "./texts.js";

export interface Wiring {
  readonly config: Config;
  readonly memberList: MemberList;
  readonly iam: IamDeps;
  readonly upload: UploadDeps;
  readonly log: (line: string) => void;
}

/**
 * Logs in, registers the slash commands on the alliance server (guild commands show up at once) and answers:
 * /iam, /link, and screenshots posted in the upload channel. Reading attachments needs the Message Content
 * intent, switched on in the developer portal (Bot > Privileged Gateway Intents).
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
    else if (interaction.isChatInputCommand()) void command(interaction, w).catch((e: unknown) => w.log(`/${interaction.commandName} failed: ${String(e)}`));
  });

  client.on(Events.MessageCreate, (message) => {
    if (message.author.bot || message.guildId !== w.config.guildId || message.channelId !== w.config.uploadChannelId) return;
    if (!message.attachments.size) return;
    void upload(message, w).catch((e: unknown) => w.log(`Upload ${message.id} failed: ${String(e)}`));
  });

  const rest = new REST().setToken(w.config.discordToken);
  await rest.put(Routes.applicationGuildCommands(w.config.appId, w.config.guildId), { body: commands });
  await client.login(w.config.discordToken);
  return client;
}

async function autocomplete(interaction: AutocompleteInteraction, w: Wiring): Promise<void> {
  // Discord gives 3 seconds: answer from the cached list and refresh it in the background
  const typed = String(interaction.options.getFocused());
  const cached = w.memberList.peek();
  void w.memberList.names().catch(() => undefined);
  await interaction
    .respond(suggestMembers(cached, typed).map((n) => ({ name: n, value: n })))
    .catch(() => undefined);
}

async function command(interaction: ChatInputCommandInteraction, w: Wiring): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const name = interaction.options.getString("name", true);
  if (interaction.commandName === "iam") {
    const outcome = await claimName(interaction.user.id, name, w.iam);
    if (outcome.kind === "linked") w.log(`${interaction.user.id} is ${outcome.member} (/iam).`);
    await interaction.editReply(iamText(outcome, w.config.uploadChannelId));
  } else if (interaction.commandName === "link") {
    const user = interaction.options.getUser("user", true);
    const outcome = await assignName(user.id, name, w.iam);
    if (outcome.kind === "linked") w.log(`${user.id} is ${outcome.member} (/link by ${interaction.user.id}).`);
    await interaction.editReply(linkText(outcome, user.id));
  }
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
