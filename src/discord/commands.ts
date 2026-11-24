import { PermissionFlagsBits, SlashCommandBuilder, type RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";
import type { SheetKey } from "../config.js";
import { EXPORTS, type ExportCommand } from "../exports/exports.js";
import { MAX_PICTURES } from "../uploads/upload.js";

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

/** The attachment options of /whisper: picture, picture2 ... picture10. */
export const WHISPER_OPTIONS: readonly string[] = Array.from({ length: MAX_PICTURES }, (_, i) => (i ? `picture${i + 1}` : "picture"));

export const whisperCommand = (() => {
  const c = new SlashCommandBuilder()
    .setName("whisper")
    .setDescription("Send screenshots only to Carlos: nobody else in the channel sees them")
    .setDMPermission(false);
  for (const [i, name] of WHISPER_OPTIONS.entries()) {
    c.addAttachmentOption((o) =>
      o.setName(name).setDescription(i ? `Screenshot ${i + 1}` : "A screenshot (add more with picture2 ... picture10)").setRequired(i === 0),
    );
  }
  return c;
})();

export const playerCommand = new SlashCommandBuilder()
  .setName("player")
  .setDescription("Look up a player: AD scores, donations, squads and coachman duties")
  .setDMPermission(false)
  .addStringOption((o) =>
    o.setName("name").setDescription("Name, or part of it (also former members)").setRequired(true).setAutocomplete(true).setMinLength(2).setMaxLength(60),
  );

const EXPORT_COMMANDS: Record<ExportCommand, { sheet: SheetKey; description: string }> = {
  coachman: { sheet: "coachman", description: "Coachman Express texts: schedule, daily message, rules and more" },
  events: { sheet: "events", description: "Event Calendar texts: the week's events and the daily AD notice" },
  kvk: { sheet: "kvk", description: "Who comes to the KvK battle" },
  vote: { sheet: "stats", description: "Officers: the vote lists from Alliance Statistics" },
};

type CommandBuilder = { toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };

function exportCommand(name: ExportCommand, description: string): CommandBuilder {
  const c = new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
  const list = EXPORTS[name];
  if (list.length > 1) {
    c.addStringOption((o) =>
      o
        .setName("what")
        .setDescription("Which text")
        .setRequired(true)
        .addChoices(...list.map((d) => ({ name: d.label, value: d.key }))),
    );
  }
  c.addBooleanOption((o) => o.setName("post").setDescription("Officers: post it in this channel for everyone"));
  return c;
}

/** The commands for this alliance: the sheet commands only for the sheets Carlos has a link to. */
export function buildCommands(sheets: Readonly<Partial<Record<SheetKey, string>>>): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  const list: CommandBuilder[] = [iamCommand, linkCommand, whisperCommand];
  if (sheets.coachman) list.push(playerCommand);
  for (const [name, c] of Object.entries(EXPORT_COMMANDS) as [ExportCommand, { sheet: SheetKey; description: string }][]) {
    if (sheets[c.sheet]) list.push(exportCommand(name, c.description));
  }
  return list.map((c) => c.toJSON());
}
