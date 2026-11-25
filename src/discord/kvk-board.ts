import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, type ButtonInteraction, type Client } from "discord.js";
import type { CallSheet } from "../exports/exports.js";
import {
  KVK_NO,
  KVK_YES,
  kvkDue,
  kvkInviteEmbed,
  readinessEmbed,
  readKvkAnswer,
  readKvkNext,
  readKvkReadiness,
  voteFields,
  type NextKvk,
} from "../kvk/kvk.js";
import { SheetError } from "../sheet/sheet.js";
import type { KvkStore } from "../storage/kvk-store.js";
import { announce, HERE } from "./announce.js";

export interface KvkDeps {
  readonly callSheet: CallSheet;
  readonly store: KvkStore;
  /** The announcement channel: the vote card and the readiness card. */
  readonly channelId: string;
  /** The member a Discord account is linked to. */
  readonly memberOf: (discordId: string) => string | undefined;
  readonly now: () => Date;
  readonly log: (line: string) => void;
}

const TICK_MS = 60_000;
const ASK_MS = 5 * 60_000;

function voteRow(day: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(KVK_YES + day).setLabel("Participate").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(KVK_NO + day).setLabel("Stay out").setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Asks KvK Planning for the coming battle every few minutes and, every minute, posts what is due: the vote card,
 * then, once Day VI started, the KvK Readiness card. Returns a stop function.
 */
export function startKvkBoard(client: Client, d: KvkDeps): () => void {
  let next: NextKvk | undefined;
  let askedAt = 0;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const now = d.now();
      if (!next || now.getTime() - askedAt >= ASK_MS) {
        const read = readKvkNext(await d.callSheet("kvk", "kvkNext", {}));
        askedAt = now.getTime();
        if (!read) d.log("KvK: the sheet sent an answer Carlos cannot read.");
        else next = read;
      }
      if (!next) return;
      const due = kvkDue(next, d.store.posts(next.day), now);
      if (due === "invite") await postInvite(client, next, d);
      else if (due === "readiness") {
        await postReadiness(client, next, d);
        next = undefined;
      }
    } catch (e) {
      d.log(`KvK: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      busy = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), TICK_MS);
  return () => clearInterval(timer);
}

async function postInvite(client: Client, next: NextKvk, d: KvkDeps): Promise<void> {
  const msg = await announce(client, d.channelId, { content: HERE, embeds: [kvkInviteEmbed(next)], components: [voteRow(next.day)] }, true);
  d.store.invited(next.day, d.channelId, msg.id);
  d.log(`KvK ${next.day}: vote card posted.`);
}

async function postReadiness(client: Client, next: NextKvk, d: KvkDeps): Promise<void> {
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

async function closeInvite(client: Client, next: NextKvk, d: KvkDeps): Promise<void> {
  const posts = d.store.posts(next.day);
  if (!posts.inviteMessageId || !posts.channelId) return;
  try {
    const channel = await client.channels.fetch(posts.channelId);
    if (!channel?.isSendable()) return;
    const msg = await channel.messages.fetch(posts.inviteMessageId);
    await msg.edit({ embeds: [kvkInviteEmbed(next, true)], components: [] });
  } catch (e) {
    d.log(`KvK ${next.day}: vote card not closed (${String(e)}).`);
  }
}

/** Participate or Stay out: writes the linked member's answer and updates the lists on the card. */
export async function kvkButton(interaction: ButtonInteraction, d: KvkDeps): Promise<void> {
  const yes = interaction.customId.startsWith(KVK_YES);
  const day = interaction.customId.slice((yes ? KVK_YES : KVK_NO).length);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = d.memberOf(interaction.user.id);
  if (!member) {
    await interaction.editReply("Carlos does not know who you are in the game yet. Link your account with /iam first, then press the button again.");
    return;
  }
  let answer;
  try {
    answer = readKvkAnswer(await d.callSheet("kvk", "kvkAnswer", { day, member, vote: yes ? "Yes" : "No" }));
  } catch (e) {
    await interaction.editReply(e instanceof SheetError ? e.message : "Something went wrong. Please try again.");
    return;
  }
  if (!answer) {
    await interaction.editReply("The KvK sheet sent an answer Carlos cannot read.");
    return;
  }
  d.log(`KvK ${day}: ${member} ${yes ? "participates" : "stays out"}${answer.changed ? "" : " (again)"}.`);
  await interaction.editReply(
    yes
      ? `You are in for the KvK battle, ${member}. Changed your mind? Press **Stay out** before Day VI starts.`
      : `Noted: you stay out of the KvK battle, ${member}. Press **Participate** if you can make it after all.`,
  );
  const embed = interaction.message.embeds[0];
  if (embed) {
    await interaction.message.edit({ embeds: [{ ...embed.toJSON(), fields: voteFields(answer.yes, answer.no) }] }).catch(() => undefined);
  }
}
