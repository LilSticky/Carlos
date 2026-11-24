import type { Sheet } from "../sheet/sheet.js";

/** Lower case, without accents and spaces: how a typed name is compared with the member list. */
export function fold(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/g, "").toLowerCase();
}

/** The member a typed name means: an exact match ignoring case, accents and spaces, else undefined. */
export function findMember(names: readonly string[], typed: string): string | undefined {
  const key = fold(typed);
  return key ? names.find((n) => fold(n) === key) : undefined;
}

/** Up to `limit` names for autocomplete: names that start with the text first, then names that contain it. */
export function suggestMembers(names: readonly string[], typed: string, limit = 25): string[] {
  const key = fold(typed);
  if (!key) return names.slice(0, limit);
  const starts = names.filter((n) => fold(n).startsWith(key));
  const contains = names.filter((n) => !fold(n).startsWith(key) && fold(n).includes(key));
  return [...starts, ...contains].slice(0, limit);
}

/**
 * The member list, kept for a few minutes: Discord wants autocomplete answers within 3 seconds, and the
 * sheet takes about as long. `fresh` always asks the sheet.
 */
export class MemberList {
  private cached: { names: string[]; at: number } | undefined;

  constructor(
    private readonly sheet: Pick<Sheet, "members">,
    private readonly now: () => number,
    private readonly maxAgeMs = 5 * 60_000,
  ) {}

  async names(): Promise<string[]> {
    if (this.cached && this.now() - this.cached.at < this.maxAgeMs) return this.cached.names;
    return this.fresh();
  }

  async fresh(): Promise<string[]> {
    const names = await this.sheet.members();
    this.cached = { names, at: this.now() };
    return names;
  }

  /** The cached names, or [] when none are cached yet (for autocomplete that must not wait). */
  peek(): string[] {
    return this.cached?.names ?? [];
  }
}
