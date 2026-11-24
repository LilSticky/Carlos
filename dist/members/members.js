/** Lower case, without accents and spaces: how a typed name is compared with the member list. */
export function fold(text) {
    return text.normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/g, "").toLowerCase();
}
/** The member a typed name means: an exact match ignoring case, accents and spaces, else undefined. */
export function findMember(names, typed) {
    const key = fold(typed);
    return key ? names.find((n) => fold(n) === key) : undefined;
}
/** Up to `limit` names for autocomplete: names that start with the text first, then names that contain it. */
export function suggestMembers(names, typed, limit = 25) {
    const key = fold(typed);
    if (!key)
        return names.slice(0, limit);
    const starts = names.filter((n) => fold(n).startsWith(key));
    const contains = names.filter((n) => !fold(n).startsWith(key) && fold(n).includes(key));
    return [...starts, ...contains].slice(0, limit);
}
/**
 * The member list, kept for a few minutes: Discord wants autocomplete answers within 3 seconds, and the
 * sheet takes about as long. `fresh` always asks the sheet.
 */
export class MemberList {
    sheet;
    now;
    maxAgeMs;
    cached;
    constructor(sheet, now, maxAgeMs = 5 * 60_000) {
        this.sheet = sheet;
        this.now = now;
        this.maxAgeMs = maxAgeMs;
    }
    async names() {
        if (this.cached && this.now() - this.cached.at < this.maxAgeMs)
            return this.cached.names;
        return this.fresh();
    }
    async fresh() {
        const names = await this.sheet.members();
        this.cached = { names, at: this.now() };
        return names;
    }
    /** The cached names, or [] when none are cached yet (for autocomplete that must not wait). */
    peek() {
        return this.cached?.names ?? [];
    }
}
//# sourceMappingURL=members.js.map