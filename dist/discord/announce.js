/** Pings everyone online who can see the channel. */
export const HERE = "@here";
/**
 * Posts in the announcement channel (ANNOUNCE_CHANNEL_ID): invitation cards, event announcements and votes go there
 * with `@here`; follow-ups like plans and readiness cards go there without it. Carlos needs the permission
 * "Mention @everyone, @here and All Roles" in that channel, or Discord drops the ping.
 */
export async function announce(client, channelId, message, here) {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isSendable())
        throw new Error(`cannot post in channel ${channelId}`);
    const users = message.allowedMentions?.users ?? [];
    return channel.send({
        ...message,
        allowedMentions: here ? { parse: ["everyone"], users } : { users },
    });
}
//# sourceMappingURL=announce.js.map