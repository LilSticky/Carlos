/** Everything Carlos says in Discord, in one place. */
export function iamText(outcome, uploadChannelId) {
    switch (outcome.kind) {
        case "linked":
            return `Thanks, you are **${outcome.member}**. Post your screenshots in <#${uploadChannelId}>, up to 10 at once, or send them with **/whisper** so only Carlos sees them.`;
        case "unchanged":
            return `You are already **${outcome.member}**.`;
        case "unknown":
            return `**${outcome.typed}** is not on the member list. Pick your name from the suggestions. Not on it? Ask an officer to add you first.`;
        case "taken":
            return `**${outcome.member}** is already linked to another Discord account. If that is wrong, ask an officer: they can fix it with /lead link.`;
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
/** Failed uploads a second try can fix: the Retry button under the reply sends the same pictures again. */
export function canRetryUpload(outcome) {
    return outcome.kind === "not-linked" || outcome.kind === "not-a-member" || outcome.kind === "failed";
}
/** `retry`: the reply carries the Retry button (a post in the upload channel), so it says to press it. */
export function uploadText(outcome, retry = false) {
    const again = retry ? "press **Retry**" : "send your screenshots again";
    switch (outcome.kind) {
        case "not-linked":
            return `Who are you in the game? Tell me once with **/iam**, then ${again}.`;
        case "not-a-member":
            return `**${outcome.member}** is not on the member list any more. Pick your name again with **/iam**, or ask an officer. Then ${again}.`;
        case "no-pictures":
            return undefined; // a chat line in the channel: say nothing
        case "unreadable":
            return `Picture ${outcome.index + 1} cannot be opened. Nothing was sent. Send normal screenshots and try again.`;
        case "sent": {
            const what = outcome.count === 1 ? "1 picture" : `${outcome.count} pictures`;
            const left = outcome.skipped ? ` (${outcome.skipped} other file${outcome.skipped === 1 ? "" : "s"} left out)` : "";
            return `Thanks, **${outcome.member}**! ${what} sent to the officers${left}. They are read within the next minutes.`;
        }
        case "failed":
            if (retry) {
                return outcome.sent
                    ? `${outcome.error} Only ${outcome.sent} of ${outcome.count} pictures arrived: press **Retry** later to send all of them again.`
                    : `${outcome.error} Press **Retry** to send them again.`;
            }
            return outcome.sent
                ? `${outcome.error} Only ${outcome.sent} of ${outcome.count} pictures arrived: send all of them again later.`
                : outcome.error;
    }
}
/** Under a video in the video channel: which ranking it shows. `postedOn` for an older post found on start. */
export function askKindText(postedOn) {
    const old = postedOn ? ` It was posted on ${postedOn}: check the date in the import tab.` : "";
    return `Which ranking does this recording show? Pick it below and Carlos sends it to the Upload Inbox.${old}`;
}
export const KIND_LATER = "later";
export const KIND_SKIP = "skip";
/** The menu's two answers besides the kinds. */
export const KIND_OTHER_OPTIONS = [
    { value: KIND_LATER, label: "No import for this event yet", description: "Carlos asks again once the sheet can read it" },
    { value: KIND_SKIP, label: "Leave it", description: "Already imported, or not a ranking" },
];
export function recordingText(outcome) {
    switch (outcome.kind) {
        case "not-linked":
            return "Who are you in the game? Tell Carlos once with **/iam**. Only R4 and R5 can send recordings.";
        case "not-officer":
            return `**${outcome.member}** is not R4 or R5 on the member list, so Carlos cannot send this recording. An R4 or R5 can post it instead.`;
        case "no-video":
            return "This post has no video Carlos can send.";
        case "too-big":
            return `The video is too big (${outcome.mb} MB, up to 400 MB). Record only the ranking, or lower the quality.`;
        case "unreadable":
            return "Carlos could not download the video. Post it again.";
        case "sent": {
            const others = outcome.others ? ` The other ${outcome.others === 1 ? "video" : `${outcome.others} videos`} of this post were left out: post one recording per message.` : "";
            return `Sent as **${outcome.label}** (${outcome.mb} MB, from ${outcome.member}). The AI reads it within the next runs and fills the import tab, where an officer checks and imports it.${others}`;
        }
        case "failed":
            return `${outcome.error} Pick the ranking again to retry.`;
    }
}
export const LATER_TEXT = "No import for this event yet. Carlos asks again once the sheet can read a new kind of ranking.";
export const SKIPPED_TEXT = "Left out: Carlos does not send this recording.";
/** /overlay: the connect code is shown only here, only to the member. */
export function overlayText(outcome) {
    switch (outcome.kind) {
        case "key":
            return [
                `Your overlay key, **${outcome.member}**. Paste this whole code into the overlay app once (Connect):`,
                "```",
                outcome.code,
                "```",
                "Keep it to yourself: it sends screenshots under your name. Any key you had before no longer works. Lost your phone? Use **/overlay** with **off: True**.",
            ].join("\n");
        case "revoked":
            return outcome.had
                ? `Your overlay key is off, **${outcome.member}**. Use **/overlay** for a new one.`
                : `You had no overlay key, **${outcome.member}**. Use **/overlay** to get one.`;
        case "who":
            return "Who are you in the game? Tell Carlos once with **/iam**, then use **/overlay** again.";
        case "failed":
            return outcome.error;
    }
}
//# sourceMappingURL=texts.js.map