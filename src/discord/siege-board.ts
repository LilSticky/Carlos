import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import type { CallSheet } from "../exports/exports.js";
import { SheetError } from "../sheet/sheet.js";
import {
  dueNow,
  inviteEmbed,
  planEmbeds,
  planHelpers,
  readJoin,
  readLeave,
  readNext,
  readPlan,
  SIEGE_BUTTON,
  SIEGE_LEAVE,
  stamp,
  type NextSiege,
  type SiegePlan,
} from "../siege/siege.js";
import type { SiegeStore } from "../storage/siege-store.js";
import { announce, HERE } from "./announce.js";

export interface SiegeDeps {
  readonly callSheet: CallSheet;
  readonly store: SiegeStore;
  /** The announcement channel: the invitation and the plan. */
  readonly channelId: string;
  /** The member a Discord account is linked to. */
  readonly memberOf: (discordId: string) => string | undefined;
  /** A Discord account linked to a member, for mentions. */
  readonly discordOf: (member: string) => string | undefined;
  readonly now: () => Date;
  readonly log: (line: string) => void;
}

const TICK_MS = 60_000;
const ASK_MS = 5 * 60_000;

function participateRow(run: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(SIEGE_BUTTON + run).setLabel("Participate").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(SIEGE_LEAVE + run).setLabel("Stay out").setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Asks the sheet for the next siege every few minutes and, every minute, posts what is due: the invitation, then the
 * plan. Returns a stop function.
 */
export function startSiegeBoard(client: Client, d: SiegeDeps): () => void {
  let next: NextSiege | null | undefined;
  let askedAt = 0;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const now = d.now();
      if (next === undefined || now.getTime() - askedAt >= ASK_MS) {
        const read = readNext(await d.callSheet("siege", "next", {}));
        askedAt = now.getTime();
        if (read === undefined) d.log("Siege: the sheet sent an answer Carlos cannot read.");
        else next = read;
      }
      if (!next) return;
      const due = dueNow(next, d.store.posts(next.run), now);
      if (due === "invite") await postInvite(client, next, d);
      else if (due === "plan") {
        await postPlan(client, next.run, d.channelId, d);
        next = undefined; // ask again: the sheet then offers the following siege
      }
    } catch (e) {
      d.log(`Siege: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      busy = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), TICK_MS);
  return () => clearInterval(timer);
}

async function textChannel(client: Client, id: string) {
  const channel = await client.channels.fetch(id);
  if (!channel?.isSendable()) throw new Error(`cannot post in channel ${id}`);
  return channel;
}

async function postInvite(client: Client, next: NextSiege, d: SiegeDeps): Promise<void> {
  const msg = await announce(client, d.channelId, { content: HERE, embeds: [inviteEmbed(next)], components: [participateRow(next.run)] }, true);
  d.store.invited(next.run, d.channelId, msg.id);
  d.log(`Siege ${next.run}: invitation posted.`);
}

/** Makes the plan in the sheet and posts it; closes the invitation. Returns the plan, or the error text. */
async function makePlan(run: string, d: SiegeDeps): Promise<SiegePlan | string> {
  try {
    const plan = readPlan(await d.callSheet("siege", "plan", { run }));
    if (plan) return plan;
    d.log("Siege plan: the sheet sent an answer Carlos cannot read.");
    return "The Undead Siege sheet sent an answer Carlos cannot read.";
  } catch (e) {
    return e instanceof SheetError ? e.message : "Something went wrong. Please try again.";
  }
}

function mentionLine(plan: SiegePlan, d: SiegeDeps): { content: string; users: string[] } {
  const users = planHelpers(plan)
    .map((h) => d.discordOf(h))
    .filter((id): id is string => !!id);
  const unique = [...new Set(users)];
  return { content: unique.length ? `Your squads are needed: ${unique.map((u) => `<@${u}>`).join(" ")}`.slice(0, 1900) : "", users: unique };
}

async function postPlan(client: Client, run: string, channelId: string, d: SiegeDeps): Promise<void> {
  const plan = await makePlan(run, d);
  if (typeof plan === "string") {
    d.log(`Siege ${run}: no plan (${plan}).`);
    d.store.planned(run, channelId, d.now()); // not again every minute; an officer can still use /lead siege
    return;
  }
  const channel = await textChannel(client, channelId);
  const m = mentionLine(plan, d);
  await channel.send({ ...(m.content ? { content: m.content } : {}), embeds: planEmbeds(plan), allowedMentions: { users: m.users } });
  d.store.planned(run, channelId, d.now());
  await closeInvite(client, plan, d);
  d.log(`Siege ${run}: plan posted (${plan.orders.length} squads).`);
}

async function closeInvite(client: Client, plan: SiegePlan, d: SiegeDeps): Promise<void> {
  const posts = d.store.posts(plan.run);
  if (!posts.inviteMessageId || !posts.channelId) return;
  try {
    const channel = await textChannel(client, posts.channelId);
    const msg = await channel.messages.fetch(posts.inviteMessageId);
    const next: NextSiege = { run: plan.run, start: plan.start, stage: plan.stage, inviteAt: plan.start, planAt: plan.start, signedUp: plan.signedUp };
    await msg.edit({ embeds: [inviteEmbed(next, true)], components: [] });
  } catch (e) {
    d.log(`Siege ${plan.run}: invitation not closed (${String(e)}).`);
  }
}

/** Participate or Stay out: signs the linked member up or off and updates the list on the invitation. */
export async function siegeButton(interaction: ButtonInteraction, d: SiegeDeps): Promise<void> {
  if (interaction.customId.startsWith(SIEGE_LEAVE)) return siegeLeave(interaction, d);
  const run = interaction.customId.slice(SIEGE_BUTTON.length);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = d.memberOf(interaction.user.id);
  if (!member) {
    await interaction.editReply("Carlos does not know who you are in the game yet. Link your account with /iam first, then press Participate again.");
    return;
  }
  let answer;
  try {
    answer = readJoin(await d.callSheet("siege", "join", { run, member }));
  } catch (e) {
    await interaction.editReply(e instanceof SheetError ? e.message : "Something went wrong. Please try again.");
    return;
  }
  if (!answer) {
    await interaction.editReply("The Undead Siege sheet sent an answer Carlos cannot read.");
    return;
  }
  d.log(`Siege ${run}: ${member} ${answer.added ? "signed up" : "pressed Participate again"}.`);
  await interaction.editReply(
    answer.added
      ? `You are in, ${member}. Your spare squads are planned in; check the plan before the start. Plans changed? Press **Stay out**.`
      : `You were already signed up, ${member}.`,
  );
  await showSignedUp(interaction, answer.signedUp);
}

async function showSignedUp(interaction: ButtonInteraction, signedUp: readonly string[]): Promise<void> {
  const embed = interaction.message.embeds[0];
  if (embed) {
    const fields = [{ name: `Signed up (${signedUp.length})`, value: signedUp.join(", ").slice(0, 1000) || "Nobody yet." }];
    await interaction.message.edit({ embeds: [{ ...embed.toJSON(), fields }] }).catch(() => undefined);
  }
}

/** Stay out: takes the linked member off the siege again (until the start). */
async function siegeLeave(interaction: ButtonInteraction, d: SiegeDeps): Promise<void> {
  const run = interaction.customId.slice(SIEGE_LEAVE.length);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = d.memberOf(interaction.user.id);
  if (!member) {
    await interaction.editReply("Carlos does not know who you are in the game yet. Link your account with /iam first.");
    return;
  }
  let answer;
  try {
    answer = readLeave(await d.callSheet("siege", "leave", { run, member }));
  } catch (e) {
    await interaction.editReply(e instanceof SheetError ? e.message : "Something went wrong. Please try again.");
    return;
  }
  if (!answer) {
    await interaction.editReply("The Undead Siege sheet sent an answer Carlos cannot read.");
    return;
  }
  d.log(`Siege ${run}: ${member} ${answer.removed ? "stays out" : "pressed Stay out without being signed up"}.`);
  await interaction.editReply(
    answer.removed ? `You are off the list, ${member}. Press **Participate** if you can make it after all.` : `You were not signed up, ${member}.`,
  );
  await showSignedUp(interaction, answer.signedUp);
}

/** /lead siege: makes the plan now and posts it in this channel (the asker's reply is deferred, privately). */
export async function siegeNow(interaction: ChatInputCommandInteraction, d: SiegeDeps): Promise<void> {
  let run = "";
  try {
    const next = readNext(await d.callSheet("siege", "next", {}));
    if (!next) {
      await interaction.editReply(next === null ? "No Undead Siege is planned in the Event Calendar." : "The Undead Siege sheet sent an answer Carlos cannot read.");
      return;
    }
    run = next.run;
  } catch (e) {
    await interaction.editReply(e instanceof SheetError ? e.message : "Something went wrong. Please try again.");
    return;
  }
  const plan = await makePlan(run, d);
  if (typeof plan === "string") {
    await interaction.editReply(plan);
    return;
  }
  const channel = interaction.channel;
  if (!channel?.isSendable()) {
    await interaction.editReply("Carlos cannot post in this channel.");
    return;
  }
  const m = mentionLine(plan, d);
  await channel.send({ ...(m.content ? { content: m.content } : {}), embeds: planEmbeds(plan), allowedMentions: { users: m.users } });
  await interaction.editReply(`Plan for the Undead Siege at ${stamp(plan.start)} posted: ${plan.summary}`);
  d.log(`Siege ${run}: plan posted by ${interaction.user.id} (/lead siege).`);
}
