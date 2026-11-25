import { PermissionFlagsBits, SlashCommandBuilder, SlashCommandSubcommandBuilder, } from "discord.js";
import { FAQ_TEXTS, isTextKey, MEMBER_TEXTS, TEXTS } from "../exports/exports.js";
import { MAX_PICTURES } from "../uploads/upload.js";
import { memberHelp } from "./help.js";
/** The option every command and /lead subcommand has: its help instead of what it does. */
export const HELP_OPTION = "help";
/**
 * Adds the help option. What a command needs is not marked required on Discord, so help works on its own; Carlos
 * shows the help when something it needs is missing.
 */
function withHelp(c) {
    c.addBooleanOption((o) => o.setName(HELP_OPTION).setDescription("How this command works, with examples"));
    return c;
}
export const iamCommand = withHelp(new SlashCommandBuilder()
    .setName("iam")
    .setDescription("Tell Carlos who you are in the game, so your screenshots go under your name")
    .setDMPermission(false)
    .addStringOption((o) => o.setName("name").setDescription("Your name on the alliance member list").setAutocomplete(true).setMaxLength(60)));
/** The attachment options of /whisper: picture, picture2 ... picture10. */
export const WHISPER_OPTIONS = Array.from({ length: MAX_PICTURES }, (_, i) => (i ? `picture${i + 1}` : "picture"));
export const whisperCommand = (() => {
    const c = new SlashCommandBuilder()
        .setName("whisper")
        .setDescription("Send screenshots only to Carlos: nobody else in the channel sees them")
        .setDMPermission(false);
    for (const [i, name] of WHISPER_OPTIONS.entries()) {
        c.addAttachmentOption((o) => o.setName(name).setDescription(i ? `Screenshot ${i + 1}` : "A screenshot (add more with picture2 ... picture10)"));
    }
    return withHelp(c);
})();
export const overlayCommand = withHelp(new SlashCommandBuilder()
    .setName("overlay")
    .setDescription("Your personal key for the overlay app: a button over the game that sends screenshots")
    .setDMPermission(false)
    .addBooleanOption((o) => o.setName("off").setDescription("Turn your current key off instead of making a new one")));
export const playerCommand = withHelp(new SlashCommandBuilder()
    .setName("player")
    .setDescription("A player's combat card: Might, readiness, squads, heroes, gear and what reports showed")
    .setDMPermission(false)
    .addStringOption((o) => o.setName("name").setDescription("Name, or part of it: our members and players seen in reports").setAutocomplete(true).setMinLength(2).setMaxLength(60)));
/** /whois: any player of the game from the Last Asylum Tracker, by uid or complete name. */
export const whoisCommand = withHelp(new SlashCommandBuilder()
    .setName("whois")
    .setDescription("Any player of the game from the Last Asylum Tracker: Might, alliance, rank, where they sit")
    .setDMPermission(false)
    .addStringOption((o) => o.setName("name").setDescription("The player's complete in-game name").setMaxLength(32))
    .addStringOption((o) => o.setName("uid").setDescription("The player's uid (the number on the profile)").setMaxLength(20))
    .addIntegerOption((o) => o.setName("kingdom").setDescription("The player's Kingdom, to narrow a name down").setMinValue(1).setMaxValue(9999)));
/** /alliance: an alliance and its roster from the Last Asylum Tracker, by tag or full name in one Kingdom. */
export const allianceCommand = withHelp(new SlashCommandBuilder()
    .setName("alliance")
    .setDescription("An alliance and its members from the Last Asylum Tracker")
    .setDMPermission(false)
    .addStringOption((o) => o.setName("search").setDescription("The alliance tag, or its complete name").setMaxLength(40))
    .addIntegerOption((o) => o.setName("kingdom").setDescription("The Kingdom (default: ours)").setMinValue(1).setMaxValue(9999)));
export const farmsCommand = withHelp(new SlashCommandBuilder()
    .setName("farms")
    .setDescription("Players without an alliance tag with lots of resources: pick the one you attack")
    .setDMPermission(false));
/** /faq: the reference texts of the linked sheets (how to drive, house rules), one to pick. */
function faqCommand(sheets) {
    const topics = FAQ_TEXTS.filter((k) => sheets[TEXTS[k].sheet]);
    if (!topics.length)
        return undefined;
    return withHelp(new SlashCommandBuilder()
        .setName("faq")
        .setDescription("Look something up: how to drive the coachman, the house rules")
        .setDMPermission(false)
        .addStringOption((o) => o.setName("topic").setDescription("What you want to know").addChoices(...topics.map((k) => ({ name: TEXTS[k].label, value: k })))));
}
/** The text /faq shows for a topic; only reference texts. */
export function faqText(topic) {
    return isTextKey(topic) && FAQ_TEXTS.includes(topic) ? topic : undefined;
}
const VOTES = ["nominees", "guards"];
/** The text a /lead subcommand shows: text and post only member texts, the vote only vote lists. */
export function leadText(subcommand, choice) {
    switch (subcommand) {
        case "text":
        case "post":
            return isTextKey(choice) && MEMBER_TEXTS.includes(choice) ? choice : undefined;
        case "driver":
        case "notice":
            return subcommand;
        case "vote":
            return isTextKey(choice) && VOTES.includes(choice) ? choice : undefined;
        default:
            return undefined;
    }
}
const memberName = (o, description) => o.setName("name").setDescription(description).setAutocomplete(true).setMaxLength(60);
/**
 * /lead: everything for R4 and R5. Discord shows it only to members who may manage roles (a server admin can change
 * that under Integrations); Carlos still checks the rank on the member list before it does anything.
 */
function leadCommand(sheets) {
    const c = new SlashCommandBuilder()
        .setName("lead")
        .setDescription("R4 and R5: officer tools")
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);
    const postable = MEMBER_TEXTS.filter((k) => sheets[TEXTS[k].sheet]);
    if (postable.length) {
        const choices = postable.map((k) => ({ name: TEXTS[k].label, value: k }));
        c.addSubcommand((s) => s
            .setName("text")
            .setDescription("A message for the alliance, only to you, ready to copy into the game")
            .addStringOption((o) => o.setName("what").setDescription("Which message").addChoices(...choices)));
        c.addSubcommand((s) => s
            .setName("post")
            .setDescription("Post a member text in the announcement channel for everyone (@here)")
            .addStringOption((o) => o.setName("what").setDescription("Which text").addChoices(...choices)));
    }
    c.addSubcommand((s) => s
        .setName("link")
        .setDescription("Set which member a Discord account is")
        .addUserOption((o) => o.setName("user").setDescription("The Discord account"))
        .addStringOption((o) => memberName(o, "The name on the alliance member list")));
    if (sheets.coachman) {
        c.addSubcommand((s) => s.setName("driver").setDescription("The driver reminder to send on"));
        c.addSubcommand((s) => s.setName("notice").setDescription("The nominee notice"));
    }
    if (sheets.siege) {
        c.addSubcommand((s) => s.setName("siege").setDescription("Make the Undead Siege defense plan now and post it here"));
    }
    if (sheets.stats) {
        c.addSubcommand((s) => s
            .setName("vote")
            .setDescription("A vote list to send on")
            .addStringOption((o) => o.setName("which").setDescription("Which vote").addChoices(...VOTES.map((k) => ({ name: TEXTS[k].label, value: k })))));
        c.addSubcommand((s) => s
            .setName("stats")
            .setDescription("A member's full statistics: AD, donations, tracker, duties")
            .addStringOption((o) => memberName(o, "The name on the alliance member list")));
    }
    for (const sub of c.options)
        if (sub instanceof SlashCommandSubcommandBuilder)
            withHelp(sub);
    return c;
}
/** What a command or "lead sub" needs; without it Carlos shows the help. */
const NEEDS = {
    iam: [["name"]],
    player: [["name"]],
    whois: [["name", "uid"]],
    alliance: [["search"]],
    whisper: [WHISPER_OPTIONS],
    faq: [["topic"]],
    "lead text": [["what"]],
    "lead post": [["what"]],
    "lead link": [["user"], ["name"]],
    "lead vote": [["which"]],
    "lead stats": [["name"]],
};
/**
 * True when a command should show its help: asked for with help: True, or something it needs is missing (each group
 * needs one of its options). `command` is "iam", or "lead post" for a /lead subcommand.
 */
export function wantsHelp(command, given) {
    if (given.some((o) => o.name === HELP_OPTION && o.value === true))
        return true;
    return (NEEDS[command] ?? []).some((group) => !given.some((o) => group.includes(o.name)));
}
/** /help: all commands, or one member command in detail. The /lead part shows only for officers, in the overview. */
function helpCommand(sheets) {
    const choices = memberHelp(sheets)
        .filter((e) => e.name !== "help")
        .map((e) => ({ name: `/${e.name}`, value: e.name }));
    return new SlashCommandBuilder()
        .setName("help")
        .setDescription("What each command is for; pick one to see how it works")
        .setDMPermission(false)
        .addStringOption((o) => o.setName("command").setDescription("The command to explain").addChoices(...choices));
}
/** The commands for this alliance: the sheet commands only for the sheets Carlos has a link to. */
export function buildCommands(sheets) {
    const list = [iamCommand, whisperCommand, overlayCommand];
    if (sheets.members)
        list.push(farmsCommand);
    if (sheets.stats)
        list.push(playerCommand);
    if (sheets.members)
        list.push(whoisCommand, allianceCommand);
    const faq = faqCommand(sheets);
    if (faq)
        list.push(faq);
    list.push(helpCommand(sheets), leadCommand(sheets));
    return list.map((c) => c.toJSON());
}
//# sourceMappingURL=commands.js.map