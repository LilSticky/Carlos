import { z } from "zod";
import { SheetError } from "../sheet/sheet.js";
export const EXPORTS = {
    coachman: [
        { key: "schedule", label: "Weekly schedule", sheet: "coachman", action: "schedule", officersOnly: false, discord: false },
        { key: "daily", label: "Daily chat message", sheet: "coachman", action: "daily", officersOnly: false, discord: false },
        { key: "notice", label: "Nominee notice", sheet: "coachman", action: "notice", officersOnly: false, discord: false },
        { key: "rules", label: "House rules", sheet: "coachman", action: "rules", officersOnly: false, discord: false },
        { key: "guide", label: "Driver guide", sheet: "coachman", action: "guide", officersOnly: false, discord: false },
        { key: "driver", label: "Driver reminder (officers)", sheet: "coachman", action: "driver", officersOnly: true, discord: false },
    ],
    events: [
        { key: "week", label: "This week's events", sheet: "events", action: "week", officersOnly: false, discord: false },
        { key: "ad-today", label: "AD notice: today", sheet: "events", action: "ad", args: { offset: 0 }, officersOnly: false, discord: false },
        { key: "ad-tomorrow", label: "AD notice: tomorrow", sheet: "events", action: "ad", args: { offset: 1 }, officersOnly: false, discord: false },
        { key: "elixir", label: "Elixir Scramble teams", sheet: "events", action: "elixir", officersOnly: false, discord: false },
    ],
    kvk: [{ key: "roster", label: "KvK roster", sheet: "kvk", action: "roster", officersOnly: false, discord: true }],
    vote: [
        { key: "nominees", label: "Special nomination vote", sheet: "stats", action: "votes", officersOnly: true, discord: false },
        { key: "guards", label: "Guard vote", sheet: "stats", action: "guards", officersOnly: true, discord: false },
    ],
};
export function findExport(command, key) {
    const list = EXPORTS[command];
    return key ? list.find((d) => d.key === key) : list[0];
}
const result = z.union([
    z.object({ text: z.string(), draft: z.boolean().optional(), lockedNow: z.boolean().optional() }),
    z.object({ parts: z.array(z.string()), title: z.string().optional() }),
]);
/**
 * Fetches one export. Posting in the channel is for officers; so are officer texts. A member never sees the
 * schedule while it is a draft: it may still change. Posting the schedule counts as its first export and locks it in.
 */
export async function runExport(def, request, call) {
    if ((def.officersOnly || request.post) && !(await request.isOfficer()))
        return { kind: "officers-only" };
    let raw;
    try {
        raw = await call(def.sheet, def.action, { ...def.args, ...(request.post ? { post: true } : {}) });
    }
    catch (e) {
        return e instanceof SheetError
            ? { kind: "failed", error: e.message, setup: e.setup }
            : { kind: "failed", error: "Something went wrong. Please try again.", setup: true };
    }
    const parsed = result.safeParse(raw);
    if (!parsed.success)
        return { kind: "failed", error: "The sheet sent an answer Carlos cannot read.", setup: true };
    const r = parsed.data;
    const parts = "parts" in r ? r.parts.filter((p) => p.trim()) : [r.text];
    const draft = "text" in r && r.draft === true;
    if (draft && !(await request.isOfficer()))
        return { kind: "draft" };
    return { kind: "shown", def, parts, post: request.post, draft, lockedNow: "text" in r && r.lockedNow === true };
}
export const DISCORD_LIMIT = 2000;
/**
 * Discord messages for the parts: each part on its own, longer ones split at line breaks. In-game chat texts
 * shown only to the asker go into a code block, so they copy cleanly into the game.
 */
export function toMessages(parts, codeBlock, limit = DISCORD_LIMIT) {
    const room = codeBlock ? limit - 8 : limit;
    const out = [];
    for (const part of parts) {
        const text = codeBlock ? part.replace(/```/g, "'''") : part;
        for (const piece of splitLines(text, room))
            out.push(codeBlock ? "```\n" + piece + "\n```" : piece);
    }
    return out;
}
function splitLines(text, room) {
    const pieces = [];
    let current = "";
    for (const line of text.split("\n")) {
        for (const chunk of line.length > room ? line.match(new RegExp(`[\\s\\S]{1,${room}}`, "g")) ?? [] : [line]) {
            const next = current ? current + "\n" + chunk : chunk;
            if (next.length > room) {
                pieces.push(current);
                current = chunk;
            }
            else {
                current = next;
            }
        }
    }
    if (current.trim())
        pieces.push(current);
    return pieces;
}
//# sourceMappingURL=exports.js.map