import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes, } from "discord.js";
import { findExport, runExport, toMessages } from "../exports/exports.js";
import { assignName, claimName } from "../members/iam.js";
import { suggestMembers } from "../members/members.js";
import { readPlayers, searchAnswer } from "../search/player-card.js";
import { SheetError } from "../sheet/sheet.js";
import { sendUpload } from "../uploads/upload.js";
import { buildCommands, WHISPER_OPTIONS } from "./commands.js";
import { exportText, iamText, linkText, uploadText } from "./texts.js";
const EXPORT_COMMANDS = new Set(["coachman", "events", "kvk", "vote"]);
const NO_PINGS = { parse: [] };
/**
 * Logs in, registers the slash commands on the alliance server (guild commands show up at once) and answers them,
 * plus screenshots posted in the upload channel. Reading attachments needs the Message Content intent, switched on
 * in the developer portal (Bot > Privileged Gateway Intents).
 */
export async function connect(w) {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    });
    client.once(Events.ClientReady, (ready) => {
        w.log(`Carlos is online as ${ready.user.tag}.`);
        void w.memberList.fresh().catch((e) => w.log(`Member list not loaded: ${String(e)}`));
    });
    client.on(Events.InteractionCreate, (interaction) => {
        if (interaction.guildId !== w.config.guildId)
            return;
        if (interaction.isAutocomplete())
            void autocomplete(interaction, w);
        else if (interaction.isChatInputCommand()) {
            void command(interaction, w).catch(async (e) => {
                w.log(`/${interaction.commandName} failed: ${String(e)}`);
                await interaction.editReply("Something went wrong. Please try again.").catch(() => undefined);
            });
        }
    });
    client.on(Events.MessageCreate, (message) => {
        if (message.author.bot || message.guildId !== w.config.guildId || message.channelId !== w.config.uploadChannelId)
            return;
        if (!message.attachments.size)
            return;
        void upload(message, w).catch((e) => w.log(`Upload ${message.id} failed: ${String(e)}`));
    });
    const rest = new REST().setToken(w.config.discordToken);
    await rest.put(Routes.applicationGuildCommands(w.config.appId, w.config.guildId), { body: buildCommands(w.config.sheets) });
    await client.login(w.config.discordToken);
    return client;
}
async function autocomplete(interaction, w) {
    // Discord gives 3 seconds: answer from the cached list and refresh it in the background
    const typed = String(interaction.options.getFocused());
    const cached = w.memberList.peek();
    void w.memberList.names().catch(() => undefined);
    await interaction
        .respond(suggestMembers(cached, typed).map((n) => ({ name: n, value: n })))
        .catch(() => undefined);
}
async function command(interaction, w) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const name = interaction.commandName;
    if (name === "iam") {
        const outcome = await claimName(interaction.user.id, interaction.options.getString("name", true), w.iam);
        if (outcome.kind === "linked")
            w.log(`${interaction.user.id} is ${outcome.member} (/iam).`);
        await interaction.editReply(iamText(outcome, w.config.uploadChannelId));
    }
    else if (name === "link") {
        const user = interaction.options.getUser("user", true);
        const outcome = await assignName(user.id, interaction.options.getString("name", true), w.iam);
        if (outcome.kind === "linked")
            w.log(`${user.id} is ${outcome.member} (/link by ${interaction.user.id}).`);
        await interaction.editReply(linkText(outcome, user.id));
    }
    else if (name === "whisper") {
        await whisper(interaction, w);
    }
    else if (name === "player") {
        await player(interaction, w);
    }
    else if (EXPORT_COMMANDS.has(name)) {
        await exportCommand(interaction, name, w);
    }
}
async function player(interaction, w) {
    const query = interaction.options.getString("name", true).trim();
    let raw;
    try {
        raw = await w.callSheet("coachman", "search", { query });
    }
    catch (e) {
        if (e instanceof SheetError && e.setup)
            w.log(`/player: ${e.message}`);
        await interaction.editReply(e instanceof SheetError ? e.message : "Something went wrong. Please try again.");
        return;
    }
    const players = readPlayers(raw);
    if (!players) {
        w.log("/player: the Coachman Express sent an answer Carlos cannot read.");
        await interaction.editReply("The sheet sent an answer Carlos cannot read.");
        return;
    }
    const text = searchAnswer(players, query, players.length > 0 && (await w.isOfficer(interaction.user.id)));
    await send(interaction, toMessages([text], false));
}
async function exportCommand(interaction, command, w) {
    const def = findExport(command, interaction.options.getString("what"));
    if (!def) {
        await interaction.editReply("Pick one of the offered texts.");
        return;
    }
    const post = interaction.options.getBoolean("post") ?? false;
    let officer;
    const isOfficer = () => (officer ??= w.isOfficer(interaction.user.id).catch(() => false));
    const outcome = await runExport(def, { post, isOfficer }, w.callSheet);
    if (outcome.kind === "failed" && outcome.setup)
        w.log(`/${command} ${def.key}: ${outcome.error}`);
    if (outcome.kind === "shown" && post)
        w.log(`/${command} ${def.key} posted by ${interaction.user.id}.`);
    await interaction.editReply(exportText(outcome));
    if (outcome.kind !== "shown")
        return;
    // posted: plain text for everyone; shown to the asker: in-game texts in code blocks, easy to copy into the game
    const messages = toMessages(outcome.parts, !post && !def.discord);
    for (const content of messages) {
        await interaction.followUp(post ? { content, allowedMentions: NO_PINGS } : { content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    }
}
/** The first message as the deferred reply, the rest as follow-ups, all only for the asker. */
async function send(interaction, messages) {
    const [first, ...rest] = messages;
    await interaction.editReply({ content: first ?? "Nothing to show.", allowedMentions: NO_PINGS });
    for (const content of rest)
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
}
/** Like a post in the upload channel, but the pictures and Carlos's answer are seen only by the sender. */
async function whisper(interaction, w) {
    const attachments = WHISPER_OPTIONS.flatMap((name) => {
        const a = interaction.options.getAttachment(name);
        return a ? [{ url: a.url, name: a.name, contentType: a.contentType, size: a.size }] : [];
    });
    const outcome = await sendUpload({ authorId: interaction.user.id, messageId: interaction.id, attachments }, w.upload);
    if (outcome.kind === "failed" && outcome.setup)
        w.log(`/whisper ${interaction.id}: ${outcome.error}`);
    await interaction.editReply({
        content: uploadText(outcome) ?? "None of these files is a screenshot. Nothing was sent.",
        allowedMentions: NO_PINGS,
    });
}
async function upload(message, w) {
    const working = await message.react("⏳").catch(() => undefined);
    const outcome = await sendUpload({
        authorId: message.author.id,
        messageId: message.id,
        attachments: [...message.attachments.values()].map((a) => ({
            url: a.url,
            name: a.name,
            contentType: a.contentType,
            size: a.size,
        })),
    }, w.upload);
    await working?.users.remove(message.client.user.id).catch(() => undefined);
    if (outcome.kind === "failed" && outcome.setup)
        w.log(`Upload ${message.id}: ${outcome.error}`);
    const text = uploadText(outcome);
    if (!text)
        return;
    await message.react(outcome.kind === "sent" ? "✅" : "❌").catch(() => undefined);
    await message.reply({ content: text, allowedMentions: { repliedUser: outcome.kind !== "sent" } });
}
//# sourceMappingURL=client.js.map