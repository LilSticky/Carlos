import { ActionRowBuilder, MessageFlags, StringSelectMenuBuilder, } from "discord.js";
import { kindFromText, kindsKey, officerOf, pickVideo, sendRecording } from "../recordings/recording.js";
import { askKindText, KIND_LATER, KIND_OTHER_OPTIONS, KIND_SKIP, LATER_TEXT, recordingText, SKIPPED_TEXT } from "./texts.js";
export const VIDEO_MENU = "video-kind:";
/** How many of the channel's latest posts Carlos looks through on start. */
const CATCH_UP_POSTS = 100;
const NO_PINGS = { parse: [] };
/** Posts whose video is on its way right now: a second pick waits for the first. */
const busy = new Set();
function menu(postId, kinds) {
    return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
        .setCustomId(VIDEO_MENU + postId)
        .setPlaceholder("Which ranking is it?")
        .addOptions([
        ...kinds.slice(0, 23).map((k) => ({ value: k.key, label: k.label })),
        ...KIND_OTHER_OPTIONS.map((o) => ({ value: o.value, label: o.label, description: o.description })),
    ]));
}
/** A new post in the video channel. */
export async function videoPost(message, d) {
    if (!pickVideo(attachmentsOf(message)).video || d.store.get(message.id))
        return;
    const kinds = await d.kinds();
    const who = await officerOf(message.author.id, d.recording);
    if (!who.ok) {
        d.store.set(message.id, "skipped", kindsKey(kinds), d.now());
        await message.react("❌").catch(() => undefined);
        await message.reply({ content: recordingText(who.outcome), allowedMentions: { repliedUser: true } });
        return;
    }
    const kind = kindFromText(message.content, kinds);
    if (kind)
        await send(message, kind, kinds, undefined, d);
    else
        await ask(message, kinds, undefined, d);
}
/** Asks which ranking a post shows: a new reply, or the old reply with a fresh menu. */
async function ask(post, kinds, reply, d, postedOn) {
    const content = { content: askKindText(postedOn), components: [menu(post.id, kinds)], allowedMentions: NO_PINGS };
    const asked = reply ? await reply.edit(content) : await post.reply(content);
    d.store.set(post.id, "asked", kindsKey(kinds), d.now(), asked.id);
}
/** Sends the post's video as `kind`; the answer goes into `reply` (the menu's message) or a new reply. */
async function send(post, kind, kinds, reply, d) {
    busy.add(post.id);
    try {
        d.store.set(post.id, "sending", kindsKey(kinds), d.now());
        const working = await post.react("⏳").catch(() => undefined);
        const outcome = await sendRecording({ authorId: post.author.id, attachments: attachmentsOf(post) }, kind, d.recording);
        await working?.users.remove(post.client.user.id).catch(() => undefined);
        const sent = outcome.kind === "sent";
        if (outcome.kind === "failed" && outcome.setup)
            d.log(`Recording ${post.id}: ${outcome.error}`);
        await post.react(sent ? "✅" : "❌").catch(() => undefined);
        if (sent)
            await post.reactions.cache.get("❌")?.users.remove(post.client.user.id).catch(() => undefined);
        const content = {
            content: recordingText(outcome),
            components: sent ? [] : [menu(post.id, kinds)],
            allowedMentions: NO_PINGS,
        };
        const answer = reply ? await reply.edit(content) : await post.reply(content);
        d.store.set(post.id, sent ? "sent" : "asked", kindsKey(kinds), d.now(), answer.id);
    }
    finally {
        busy.delete(post.id);
    }
}
/** A pick in the menu under a video: any R4 or R5 may answer. */
export async function videoMenu(interaction, d) {
    const postId = interaction.customId.slice(VIDEO_MENU.length);
    if (!(await d.isOfficer(interaction.user.id))) {
        await interaction.reply({ content: "Only R4 and R5 can answer this.", flags: MessageFlags.Ephemeral });
        return;
    }
    if (busy.has(postId)) {
        await interaction.reply({ content: "This recording is on its way already.", flags: MessageFlags.Ephemeral });
        return;
    }
    const kinds = await d.kinds();
    const choice = interaction.values[0];
    if (choice === KIND_LATER || choice === KIND_SKIP) {
        d.store.set(postId, choice === KIND_LATER ? "later" : "skipped", kindsKey(kinds), d.now(), interaction.message.id);
        await interaction.update({ content: choice === KIND_LATER ? LATER_TEXT : SKIPPED_TEXT, components: [], allowedMentions: NO_PINGS });
        return;
    }
    const kind = kinds.find((k) => k.key === choice);
    if (!kind) {
        await interaction.reply({ content: "The sheet no longer reads this ranking. Pick again.", flags: MessageFlags.Ephemeral });
        await interaction.message.edit({ components: [menu(postId, kinds)] }).catch(() => undefined);
        return;
    }
    const post = await interaction.channel?.messages.fetch(postId).catch(() => undefined);
    if (!post) {
        await interaction.update({ content: "The recording's post is gone. Post it again.", components: [] });
        return;
    }
    await interaction.update({ content: `Sending as **${kind.label}** ...`, components: [], allowedMentions: NO_PINGS });
    await send(post, kind, kinds, interaction.message, d);
}
/** On start: asks about videos Carlos has not handled, refreshes old menus, and asks again about put-off ones. */
export async function catchUpVideos(client, d) {
    const channel = await client.channels.fetch(d.channelId);
    if (!channel?.isTextBased() || !("messages" in channel)) {
        d.log(`VIDEO_CHANNEL_ID ${d.channelId} is not a text channel Carlos can read.`);
        return;
    }
    const kinds = await d.kinds();
    const key = kindsKey(kinds);
    const posts = [...(await channel.messages.fetch({ limit: CATCH_UP_POSTS })).values()]
        .filter((m) => !m.author.bot && pickVideo(attachmentsOf(m)).video)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    let asked = 0;
    for (const post of posts) {
        const known = d.store.get(post.id);
        if (known?.state === "sent" || known?.state === "skipped")
            continue;
        if ((known?.state === "asked" || known?.state === "later") && known.kinds === key)
            continue;
        const reply = known?.replyId ? await channel.messages.fetch(known.replyId).catch(() => undefined) : undefined;
        if (!known && !(await officerOf(post.author.id, d.recording)).ok)
            continue; // refused when it was posted
        const old = d.now().getTime() - post.createdTimestamp > 24 * 3600_000;
        await ask(post, kinds, reply, d, old ? post.createdAt.toISOString().slice(0, 10) : undefined);
        asked++;
    }
    if (asked)
        d.log(`Video inbox: asked about ${asked} recording${asked === 1 ? "" : "s"}.`);
}
function attachmentsOf(message) {
    return [...message.attachments.values()].map((a) => ({ url: a.url, name: a.name, contentType: a.contentType, size: a.size }));
}
//# sourceMappingURL=video-inbox.js.map