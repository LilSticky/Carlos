import { describe, expect, it } from "vitest";
import { SheetError } from "../sheet/sheet.js";
import { connectCode, CONNECT_PREFIX, overlayKey, type OverlayDeps } from "./overlay.js";

const KEY = "lapo_" + "ab".repeat(32);
const URL = "https://script.google.com/macros/s/AKfy-members/exec";

function deps(over: Partial<OverlayDeps> = {}): OverlayDeps & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    memberOf: (id) => (id === "1" ? "Alpha" : undefined),
    callSheet: async (sheet, action, args) => {
      calls.push([sheet, action, args]);
      return action === "overlayKey" ? { key: KEY, member: "Alpha" } : { revoked: true, member: "Alpha" };
    },
    membersUrl: URL,
    ...over,
  };
}

describe("overlayKey", () => {
  it("asks Alliance Members for a key for the linked member and packs it with the link", async () => {
    const d = deps();
    const out = await overlayKey("1", false, d);
    expect(d.calls).toEqual([["members", "overlayKey", { name: "Alpha" }]]);
    expect(out).toEqual({ kind: "key", member: "Alpha", code: connectCode(URL, KEY) });
    const code = (out as { code: string }).code;
    expect(code.startsWith(CONNECT_PREFIX)).toBe(true);
    expect(JSON.parse(Buffer.from(code.slice(CONNECT_PREFIX.length), "base64url").toString("utf8"))).toEqual({ url: URL, key: KEY });
  });

  it("turns the key off", async () => {
    const d = deps();
    expect(await overlayKey("1", true, d)).toEqual({ kind: "revoked", member: "Alpha", had: true });
    expect(d.calls).toEqual([["members", "overlayRevoke", { name: "Alpha" }]]);
  });

  it("asks who you are before anything goes to the sheet", async () => {
    const d = deps();
    expect(await overlayKey("2", false, d)).toEqual({ kind: "who" });
    expect(d.calls).toEqual([]);
  });

  it("passes the sheet's own refusal on and refuses an answer it cannot read", async () => {
    const refused = deps({ callSheet: async () => { throw new SheetError("Alpha is not on the member list."); } });
    expect(await overlayKey("1", false, refused)).toEqual({ kind: "failed", error: "Alpha is not on the member list." });
    const odd = deps({ callSheet: async () => ({ key: "nope", member: "Alpha" }) });
    expect(await overlayKey("1", false, odd)).toEqual({ kind: "failed", error: "The alliance sheet sent an answer Carlos cannot read." });
  });
});
