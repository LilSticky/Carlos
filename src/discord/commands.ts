import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const iamCommand = new SlashCommandBuilder()
  .setName("iam")
  .setDescription("Tell Carlos who you are in the game, so your screenshots go under your name")
  .setDMPermission(false)
  .addStringOption((o) =>
    o.setName("name").setDescription("Your name on the alliance member list").setRequired(true).setAutocomplete(true).setMaxLength(60),
  );

export const linkCommand = new SlashCommandBuilder()
  .setName("link")
  .setDescription("Officers: set which member a Discord account is")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addUserOption((o) => o.setName("user").setDescription("The Discord account").setRequired(true))
  .addStringOption((o) =>
    o.setName("name").setDescription("The name on the alliance member list").setRequired(true).setAutocomplete(true).setMaxLength(60),
  );

export const commands = [iamCommand, linkCommand].map((c) => c.toJSON());
