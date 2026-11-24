import { SheetError } from "../sheet/sheet.js";
import { findMember } from "./members.js";
/** /iam: a member says which name on the member list is theirs. A name held by another account stays theirs. */
export async function claimName(discordId, typed, deps) {
    const member = await lookUp(typed, deps);
    if (typeof member !== "string")
        return member;
    if (deps.links.memberOf(discordId) === member)
        return { kind: "unchanged", member };
    if (deps.links.holderOf(member, discordId))
        return { kind: "taken", member };
    deps.links.link(discordId, member, deps.now());
    return { kind: "linked", member };
}
/** /lead link: an officer sets which member a Discord account is, taking the name from any other account. */
export async function assignName(discordId, typed, deps) {
    const member = await lookUp(typed, deps);
    if (typeof member !== "string")
        return member;
    deps.links.release(member);
    deps.links.link(discordId, member, deps.now());
    return { kind: "linked", member };
}
async function lookUp(typed, deps) {
    let names;
    try {
        names = await deps.names();
    }
    catch (e) {
        return { kind: "failed", error: e instanceof SheetError ? e.message : "Something went wrong. Please try again." };
    }
    return findMember(names, typed) ?? { kind: "unknown", typed: typed.trim() };
}
//# sourceMappingURL=iam.js.map