import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { KVK_MAYBE, KVK_NO, KVK_YES, kvkDue, kvkInviteEmbed, readinessEmbed, readKvkAnswer, readKvkNext, readKvkReadiness, voteFields, } from "../kvk/kvk.js";
import { SheetError } from "../sheet/sheet.js";
import { announce, HERE } from "./announce.js";
const TICK_MS = 60_000;
const ASK_MS = 5 * 60_000;
function voteRow(day) {
    return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(KVK_YES + day).setLabel("Participate").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(KVK_NO + day).setLabel("Stay out").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(KVK_MAYBE + day).setLabel("Don't know yet").setStyle(ButtonStyle.Secondary));
}
/**
 * Asks KvK Planning for the coming battle every few minutes and, every minute, posts what is due: the vote card,
 * then, once Day VI started, the KvK Readiness card. Returns a stop function.
 */
export function startKvkBoard(client, d) {
    let next;
    let askedAt = 0;
    let busy = false;
    const tick = async () => {
        if (busy)
            return;
        busy = true;
        try {
            const now = d.now();
            if (!next || now.getTime() - askedAt >= ASK_MS) {
                const read = readKvkNext(await d.callSheet("kvk", "kvkNext", {}));
                askedAt = now.getTime();
                if (!read)
                    d.log("KvK: the sheet sent an answer Carlos cannot read.");
                else
                    next = read;
            }
            if (!next)
                return;
            const due = kvkDue(next, d.store.posts(next.day), now);
            if (due === "invite")
                await postInvite(client, next, d);
            else if (due === "readiness") {
                await postReadiness(client, next, d);
                next = undefined;
            }
        }
        catch (e) {
            d.log(`KvK: ${e instanceof Error ? e.message : String(e)}`);
        }
        finally {
            busy = false;
        }
    };
    void tick();
    const timer = setInterval(() => void tick(), TICK_MS);
    return () => clearInterval(timer);
}
async function postInvite(client, next, d) {
    // a quest card that cannot be read must not hold up the vote
    const quests = d.questCards ? await d.questCards(d.now()).catch((e) => {
        d.log(`KvK ${next.day}: quest cards left out (${e instanceof Error ? e.message : String(e)}).`);
        return undefined;
    }) : undefined;
    const embeds = [kvkInviteEmbed(next), ...(quests?.embeds ?? [])];
    const msg = await announce(client, d.channelId, { content: HERE, embeds, components: [voteRow(next.day)] }, true);
    d.store.invited(next.day, d.channelId, msg.id);
    quests?.posted(d.channelId, msg.id);
    d.log(`KvK ${next.day}: vote card posted${quests?.names.length ? ` with ${quests.names.join(", ")}` : ""}.`);
}
async function postReadiness(client, next, d) {
    const r = readKvkReadiness(await d.callSheet("kvk", "kvkReadiness", { day: next.day }));
    if (!r) {
        d.log(`KvK ${next.day}: the sheet sent a readiness Carlos cannot read.`);
        d.store.readinessPosted(next.day, d.channelId, d.now()); // not again every minute
        return;
    }
    await announce(client, d.channelId, { embeds: [readinessEmbed(r)] }, false);
    d.store.readinessPosted(next.day, d.channelId, d.now());
    await closeInvite(client, next, d);
    d.log(`KvK ${next.day}: readiness card posted (${r.yes.count} participate).`);
}
async function closeInvite(client, next, d) {
    const posts = d.store.posts(next.day);
    if (!posts.inviteMessageId || !posts.channelId)
        return;
    try {
        const channel = await client.channels.fetch(posts.channelId);
        if (!channel?.isSendable())
            return;
        const msg = await channel.messages.fetch(posts.inviteMessageId);
        // the quest cards that went out with the vote stay
        await msg.edit({ embeds: [kvkInviteEmbed(next, true), ...msg.embeds.slice(1).map((e) => e.toJSON())], components: [] });
    }
    catch (e) {
        d.log(`KvK ${next.day}: vote card not closed (${String(e)}).`);
    }
}
const BUTTONS = [
    { prefix: KVK_YES, vote: "Yes", log: "participates" },
    { prefix: KVK_NO, vote: "No", log: "stays out" },
    { prefix: KVK_MAYBE, vote: "Maybe", log: "does not know yet" },
];
/** Whether a button is one of the KvK vote card. */
export function isKvkButton(customId) {
    return BUTTONS.some((b) => customId.startsWith(b.prefix));
}
/** Participate, Stay out or Don't know yet: writes the linked member's answer and updates the lists on the card. */
export async function kvkButton(interaction, d) {
    const button = BUTTONS.find((b) => interaction.customId.startsWith(b.prefix));
    if (!button)
        return;
    const day = interaction.customId.slice(button.prefix.length);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = d.memberOf(interaction.user.id);
    if (!member) {
        await interaction.editReply("Carlos does not know who you are in the game yet. Link your account with /iam first, then press the button again.");
        return;
    }
    let answer;
    try {
        answer = readKvkAnswer(await d.callSheet("kvk", "kvkAnswer", { day, member, vote: button.vote }));
    }
    catch (e) {
        await interaction.editReply(e instanceof SheetError ? e.message : "Something went wrong. Please try again.");
        return;
    }
    if (!answer) {
        await interaction.editReply("The KvK sheet sent an answer Carlos cannot read.");
        return;
    }
    d.log(`KvK ${day}: ${member} ${button.log}${answer.changed ? "" : " (again)"}.`);
    await interaction.editReply(button.vote === "Yes"
        ? `You are in for the KvK battle, ${member}. Changed your mind? Press **Stay out** before Day VI starts.`
        : button.vote === "No"
            ? `Noted: you stay out of the KvK battle, ${member}. Press **Participate** if you can make it after all.`
            : `Noted: you don't know yet, ${member}. Thanks for answering. Press **Participate** or **Stay out** once you know, before Day VI starts.`);
    const [embed, ...others] = interaction.message.embeds;
    if (embed) {
        const embeds = [{ ...embed.toJSON(), fields: voteFields(answer.yes, answer.no, answer.maybe) }, ...others.map((e) => e.toJSON())];
        await interaction.message.edit({ embeds }).catch(() => undefined);
    }
}
//# sourceMappingURL=kvk-board.js.map