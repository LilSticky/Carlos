import { dueQuests, questEmbed } from "../scores/quest-post.js";
import { readScores } from "../scores/scores.js";
import { announce } from "./announce.js";
const TICK_MS = 15 * 60_000;
/** The cards due now; `anyHour` for the KvK vote card, which may go out before the post hour. */
export async function questCards(d, now, anyHour) {
    const data = readScores(await d.callSheet("members", "scores", {}));
    if (!data)
        throw new Error("the sheet sent an answer Carlos cannot read");
    const due = dueQuests(data, now, (k) => d.store.posted(k), anyHour);
    return {
        embeds: due.map((x) => questEmbed(x.quest, x.day, d.uploadChannelId)),
        names: due.map((x) => x.quest.quest),
        posted: (channelId, messageId) => due.forEach((x) => d.store.markPosted(x.key, channelId, messageId, now)),
    };
}
/**
 * Asks Alliance Members for the Intel Quests every quarter hour and posts each repeating quest (Days in the Intel
 * Quests tab) once on each of its days, from QUEST_POST_HOUR server time on, without @here. On a day the KvK vote
 * card is still to come, it waits: the card goes out with the vote. Returns a stop function.
 */
export function startQuestBoard(client, d) {
    let lastError = "";
    let busy = false;
    const tick = async () => {
        if (busy)
            return;
        busy = true;
        try {
            const now = d.now();
            const cards = await questCards(d, now, false);
            lastError = "";
            if (!cards.embeds.length || (d.kvkInviteLater && (await d.kvkInviteLater(now))))
                return;
            const msg = await announce(client, d.channelId, { embeds: cards.embeds }, false);
            cards.posted(d.channelId, msg.id);
            d.log(`Quest post: ${cards.names.join(", ")}.`);
        }
        catch (e) {
            // the same problem is logged once, not every quarter hour
            const text = e instanceof Error ? e.message : String(e);
            if (text !== lastError)
                d.log(`Quest post: ${text}`);
            lastError = text;
        }
        finally {
            busy = false;
        }
    };
    void tick();
    const timer = setInterval(() => void tick(), TICK_MS);
    return () => clearInterval(timer);
}
//# sourceMappingURL=quest-board.js.map