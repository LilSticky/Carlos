import { z } from "zod";
import type { CallSheet } from "../exports/exports.js";
import { SheetError } from "../sheet/sheet.js";

/**
 * /overlay: a member's personal key for the overlay app (lap-overlay), the button over the game that sends a
 * screenshot to the Upload Inbox. The app holds no SHEET_SECRET: Alliance Members makes the key (Bot.js action
 * overlayKey, rebirth-sheets members/Overlay.js), keeps only its hash, and lets the key send pictures for that
 * one member. Carlos gives it out because only Carlos knows which Discord account is which member.
 *
 * The member pastes one connect code into the app: the Members web app link and the key together.
 */
export interface OverlayDeps {
  readonly memberOf: (discordId: string) => string | undefined;
  readonly callSheet: CallSheet;
  /** The /exec link of Alliance Members' web app (MEMBERS_URL): where the app sends its pictures. */
  readonly membersUrl: string;
}

export type OverlayOutcome =
  | { readonly kind: "key"; readonly member: string; readonly code: string }
  | { readonly kind: "revoked"; readonly member: string; readonly had: boolean }
  | { readonly kind: "who" }
  | { readonly kind: "failed"; readonly error: string };

const newKey = z.object({ key: z.string().regex(/^lapo_[0-9a-f]{64}$/), member: z.string().min(1) });
const revoked = z.object({ revoked: z.boolean(), member: z.string().min(1) });

/** The prefix of a connect code, so the app can tell it from anything else pasted. */
export const CONNECT_PREFIX = "LAPO1.";

/** One text for the app: LAPO1.<base64url of {"url","key"}>. */
export function connectCode(url: string, key: string): string {
  return CONNECT_PREFIX + Buffer.from(JSON.stringify({ url, key }), "utf8").toString("base64url");
}

export async function overlayKey(discordId: string, revoke: boolean, deps: OverlayDeps): Promise<OverlayOutcome> {
  const name = deps.memberOf(discordId);
  if (!name) return { kind: "who" };
  try {
    if (revoke) {
      const r = revoked.safeParse(await deps.callSheet("members", "overlayRevoke", { name }));
      if (!r.success) throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
      return { kind: "revoked", member: r.data.member, had: r.data.revoked };
    }
    const r = newKey.safeParse(await deps.callSheet("members", "overlayKey", { name }));
    if (!r.success) throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
    return { kind: "key", member: r.data.member, code: connectCode(deps.membersUrl, r.data.key) };
  } catch (e) {
    return { kind: "failed", error: e instanceof SheetError ? e.message : "Something went wrong. Please try again." };
  }
}
