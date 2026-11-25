import { z } from "zod";
import { SheetError } from "../sheet/sheet.js";
/**
 * Every text, keyed by its own key. Messages to post are for R4 and R5 only: /lead text shows one to copy into the
 * game, /lead post posts it in the channel, /lead driver, notice and vote show the officer texts. Members look the
 * reference texts up with /faq.
 */
export const TEXTS = {
    schedule: { key: "schedule", label: "Weekly schedule", sheet: "coachman", action: "schedule", officersOnly: false, faq: false, discord: false },
    today: { key: "today", label: "Daily chat message", sheet: "coachman", action: "daily", officersOnly: false, faq: false, discord: false },
    rules: { key: "rules", label: "House rules", sheet: "coachman", action: "rules", officersOnly: false, faq: true, discord: false },
    driverguide: { key: "driverguide", label: "Driver guide", sheet: "coachman", action: "guide", officersOnly: false, faq: true, discord: false },
    events: { key: "events", label: "This week's events", sheet: "events", action: "week", officersOnly: false, faq: false, discord: false },
    "ad-today": { key: "ad-today", label: "AD notice: today", sheet: "events", action: "ad", args: { offset: 0 }, officersOnly: false, faq: false, discord: false },
    "ad-tomorrow": { key: "ad-tomorrow", label: "AD notice: tomorrow", sheet: "events", action: "ad", args: { offset: 1 }, officersOnly: false, faq: false, discord: false },
    elixir: { key: "elixir", label: "Elixir Scramble teams", sheet: "events", action: "elixir", officersOnly: false, faq: false, discord: false },
    kvk: { key: "kvk", label: "KvK roster", sheet: "kvk", action: "roster", officersOnly: false, faq: false, discord: true },
    driver: { key: "driver", label: "Driver reminder", sheet: "coachman", action: "driver", officersOnly: true, faq: false, discord: false },
    notice: { key: "notice", label: "Nominee notice", sheet: "coachman", action: "notice", officersOnly: true, faq: false, discord: false },
    nominees: { key: "nominees", label: "Special nomination vote", sheet: "stats", action: "votes", officersOnly: true, faq: false, discord: false },
    guards: { key: "guards", label: "Guard vote", sheet: "stats", action: "guards", officersOnly: true, faq: false, discord: false },
};
export function isTextKey(key) {
    return key !== null && Object.hasOwn(TEXTS, key);
}
/** The texts officers may show or post for everyone, in this order (not the officer-only ones). */
export const MEMBER_TEXTS = Object.keys(TEXTS).filter((k) => !TEXTS[k].officersOnly);
/** The reference texts every member can look up with /faq. */
export const FAQ_TEXTS = MEMBER_TEXTS.filter((k) => TEXTS[k].faq);
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