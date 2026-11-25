import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Picture {
  readonly name: string;
  readonly bytes: Uint8Array;
}

const PICTURE = /^([a-z0-9]+)(?:-(\d+))?\.(png|jpe?g|webp)$/i;

/**
 * The example pictures in `dir` (the repo's `guide/` folder): `squads.png`, or `battle-1.png`, `battle-2.png` for
 * several. Returns a lookup by image name, in number order; a missing folder means no pictures.
 */
export function loadPictures(dir: string): (image: string) => Picture[] {
  let files: string[] = [];
  try {
    files = readdirSync(dir);
  } catch {
    files = [];
  }
  const byImage = new Map<string, { n: number; pic: Picture }[]>();
  for (const name of files) {
    const m = PICTURE.exec(name);
    if (!m) continue;
    const image = m[1]!.toLowerCase();
    const list = byImage.get(image) ?? [];
    list.push({ n: Number(m[2] ?? 0), pic: { name, bytes: readFileSync(join(dir, name)) } });
    byImage.set(image, list);
  }
  return (image) => (byImage.get(image) ?? []).sort((a, b) => a.n - b.n).map((x) => x.pic).slice(0, 10);
}
