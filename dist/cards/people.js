import { z } from "zod";
import { fold } from "../members/members.js";
import { sideLabel } from "./card.js";
/**
 * Everyone /player can find: our members and the players of other alliances seen in reports (Alliance
 * Statistics, action "people"). The sheet takes several seconds for it, and autocomplete must answer within 3,
 * so the list is kept and refreshed in the background.
 */
const person = z.object({
    name: z.string(),
    member: z.boolean().catch(false),
    kingdom: z.coerce.string().optional().catch(undefined),
    alliance: z.coerce.string().optional().catch(undefined),
});
export function readPeople(raw) {
    const parsed = z.array(z.unknown()).safeParse(raw);
    if (!parsed.success)
        return [];
    return parsed.data.flatMap((p) => {
        const one = person.safeParse(p);
        return one.success ? [one.data] : [];
    });
}
/** Up to 25 autocomplete choices: names that start with the text first, members before others. */
export function suggestPeople(people, typed) {
    const key = fold(typed);
    const rank = (p) => (fold(p.name).startsWith(key) ? 0 : 2) + (p.member ? 0 : 1);
    return people
        .filter((p) => !key || fold(p.name).includes(key))
        .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
        .slice(0, 25)
        .map((p) => ({ name: `${p.name}${p.member ? "" : `  ${sideLabel(p)}`}`.slice(0, 100), value: p.name.slice(0, 100) }));
}
export class PeopleList {
    load;
    now;
    maxAgeMs;
    cached;
    loading;
    constructor(load, now, maxAgeMs = 10 * 60_000) {
        this.load = load;
        this.now = now;
        this.maxAgeMs = maxAgeMs;
    }
    /** The cached list right away; starts a refresh when it is missing or old. */
    peek() {
        if (!this.cached || this.now() - this.cached.at >= this.maxAgeMs)
            void this.refresh().catch(() => undefined);
        return this.cached?.people ?? [];
    }
    refresh() {
        this.loading ??= this.load()
            .then((people) => {
            this.cached = { people, at: this.now() };
        })
            .finally(() => {
            this.loading = undefined;
        });
        return this.loading;
    }
}
//# sourceMappingURL=people.js.map