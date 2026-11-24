import { describe, expect, it } from "vitest";
import { SheetError } from "../sheet/sheet.js";
import { LinkStore, openMemoryDatabase } from "../storage/link-store.js";
import { assignName, claimName, type IamDeps } from "./iam.js";

function deps(over: Partial<IamDeps> = {}): IamDeps & { links: LinkStore } {
  return { names: async () => ["Alpha", "Bravo"], links: new LinkStore(openMemoryDatabase()), now: () => new Date(0), ...over } as IamDeps & {
    links: LinkStore;
  };
}

describe("claimName", () => {
  it("links the name as the sheet writes it", async () => {
    const d = deps();
    expect(await claimName("1", "alpha", d)).toEqual({ kind: "linked", member: "Alpha" });
    expect(d.links.memberOf("1")).toBe("Alpha");
    expect(await claimName("1", "Alpha", d)).toEqual({ kind: "unchanged", member: "Alpha" });
  });

  it("refuses a name that is not on the member list", async () => {
    expect(await claimName("1", " Charlie ", deps())).toEqual({ kind: "unknown", typed: "Charlie" });
  });

  it("leaves a name that another account holds to that account", async () => {
    const d = deps();
    await claimName("1", "Alpha", d);
    expect(await claimName("2", "Alpha", d)).toEqual({ kind: "taken", member: "Alpha" });
    expect(d.links.memberOf("2")).toBeUndefined();
  });

  it("passes on why the sheet could not be asked", async () => {
    const d = deps({ names: async () => { throw new SheetError("did not answer"); } });
    expect(await claimName("1", "Alpha", d)).toEqual({ kind: "failed", error: "did not answer" });
  });
});

describe("assignName", () => {
  it("lets an officer move a name to another account", async () => {
    const d = deps();
    await claimName("1", "Alpha", d);
    expect(await assignName("2", "alpha", d)).toEqual({ kind: "linked", member: "Alpha" });
    expect(d.links.memberOf("1")).toBeUndefined();
    expect(d.links.memberOf("2")).toBe("Alpha");
  });
});
