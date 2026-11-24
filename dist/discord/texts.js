/** Everything Carlos says in Discord, in one place. */
export function iamText(outcome, uploadChannelId) {
    switch (outcome.kind) {
        case "linked":
            return `Thanks, you are **${outcome.member}**. Post your screenshots in <#${uploadChannelId}>, up to 10 at once.`;
        case "unchanged":
            return `You are already **${outcome.member}**.`;
        case "unknown":
            return `**${outcome.typed}** is not on the member list. Pick your name from the suggestions. Not on it? Ask an officer to add you first.`;
        case "taken":
            return `**${outcome.member}** is already linked to another Discord account. If that is wrong, ask an officer: they can fix it with /link.`;
        case "failed":
            return outcome.error;
    }
}
export function linkText(outcome, userId) {
    return outcome.kind === "linked" ? `<@${userId}> is now **${outcome.member}**.` : iamText(outcome, "");
}
/** What Carlos says to the asker about an export (the text itself goes in separate messages). */
export function exportText(outcome) {
    switch (outcome.kind) {
        case "officers-only":
            return "Only R4 and R5 can do that. If you are one, tell Carlos who you are with **/iam** first.";
        case "draft":
            return "Next week's schedule is still being planned. The officers post it once it is locked in.";
        case "failed":
            return outcome.error;
        case "shown":
            if (outcome.post)
                return `Posted: ${outcome.def.label}.${outcome.lockedNow ? " The schedule is locked in now." : ""}`;
            return `**${outcome.def.label}**${outcome.draft ? " (draft: not locked in yet, members can't see it)" : ""}`;
    }
}
export function uploadText(outcome) {
    switch (outcome.kind) {
        case "not-linked":
            return "Who are you in the game? Tell me once with **/iam**, then post your screenshots again.";
        case "not-a-member":
            return `**${outcome.member}** is not on the member list any more. Pick your name again with **/iam**, or ask an officer.`;
        case "no-pictures":
            return undefined; // a chat line in the channel: say nothing
        case "unreadable":
            return `Picture ${outcome.index + 1} cannot be opened. Nothing was sent. Post normal screenshots and try again.`;
        case "sent": {
            const what = outcome.count === 1 ? "1 picture" : `${outcome.count} pictures`;
            const left = outcome.skipped ? ` (${outcome.skipped} other file${outcome.skipped === 1 ? "" : "s"} left out)` : "";
            return `Thanks, **${outcome.member}**! ${what} sent to the officers${left}. They are read within the next minutes.`;
        }
        case "failed":
            return outcome.sent
                ? `${outcome.error} Only ${outcome.sent} of ${outcome.count} pictures arrived: post all of them again later.`
                : outcome.error;
    }
}
//# sourceMappingURL=texts.js.map