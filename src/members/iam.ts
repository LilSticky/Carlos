import { SheetError } from "../sheet/sheet.js";
import { findMember } from "./members.js";

export interface LinkPort {
  memberOf(discordId: string): string | undefined;
  holderOf(member: string, except: string): string | undefined;
  link(discordId: string, member: string, at: Date): void;
  release(member: string): void;
}

export interface IamDeps {
  readonly names: () => Promise<string[]>;
  readonly links: LinkPort;
  readonly now: () => Date;
}

export type IamOutcome =
  | { readonly kind: "linked"; readonly member: string }
  | { readonly kind: "unchanged"; readonly member: string }
  | { readonly kind: "unknown"; readonly typed: string }
  | { readonly kind: "taken"; readonly member: string }
  | { readonly kind: "failed"; readonly error: string };

/** /iam: a member says which name on the member list is theirs. A name held by another account stays theirs. */
export async function claimName(discordId: string, typed: string, deps: IamDeps): Promise<IamOutcome> {
  const member = await lookUp(typed, deps);
  if (typeof member !== "string") return member;
  if (deps.links.memberOf(discordId) === member) return { kind: "unchanged", member };
  if (deps.links.holderOf(member, discordId)) return { kind: "taken", member };
  deps.links.link(discordId, member, deps.now());
  return { kind: "linked", member };
}

/** /lead link: an officer sets which member a Discord account is, taking the name from any other account. */
export async function assignName(discordId: string, typed: string, deps: IamDeps): Promise<IamOutcome> {
  const member = await lookUp(typed, deps);
  if (typeof member !== "string") return member;
  deps.links.release(member);
  deps.links.link(discordId, member, deps.now());
  return { kind: "linked", member };
}

async function lookUp(typed: string, deps: IamDeps): Promise<string | IamOutcome> {
  let names: string[];
  try {
    names = await deps.names();
  } catch (e) {
    return { kind: "failed", error: e instanceof SheetError ? e.message : "Something went wrong. Please try again." };
  }
  return findMember(names, typed) ?? { kind: "unknown", typed: typed.trim() };
}
