import { z } from "zod";
import { SheetError } from "../sheet/sheet.js";
const newKey = z.object({ key: z.string().regex(/^lapo_[0-9a-f]{64}$/), member: z.string().min(1) });
const revoked = z.object({ revoked: z.boolean(), member: z.string().min(1) });
/** The prefix of a connect code, so the app can tell it from anything else pasted. */
export const CONNECT_PREFIX = "LAPO1.";
/** One text for the app: LAPO1.<base64url of {"url","key"}>. */
export function connectCode(url, key) {
    return CONNECT_PREFIX + Buffer.from(JSON.stringify({ url, key }), "utf8").toString("base64url");
}
export async function overlayKey(discordId, revoke, deps) {
    const name = deps.memberOf(discordId);
    if (!name)
        return { kind: "who" };
    try {
        if (revoke) {
            const r = revoked.safeParse(await deps.callSheet("members", "overlayRevoke", { name }));
            if (!r.success)
                throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
            return { kind: "revoked", member: r.data.member, had: r.data.revoked };
        }
        const r = newKey.safeParse(await deps.callSheet("members", "overlayKey", { name }));
        if (!r.success)
            throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
        return { kind: "key", member: r.data.member, code: connectCode(deps.membersUrl, r.data.key) };
    }
    catch (e) {
        return { kind: "failed", error: e instanceof SheetError ? e.message : "Something went wrong. Please try again." };
    }
}
//# sourceMappingURL=overlay.js.map