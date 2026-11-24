import { findMember } from "./members.js";
/**
 * True when the Discord account is linked to an R4 or R5. The rank comes from the member list in the sheet, so a
 * promotion counts as soon as the sheet knows it; the Discord roles play no part.
 */
export async function isOfficer(discordId, deps) {
    const member = deps.memberOf(discordId);
    if (!member)
        return false;
    return findMember(await deps.officers(), member) !== undefined;
}
//# sourceMappingURL=officers.js.map