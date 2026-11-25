import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const PICTURE = /^([a-z0-9]+)(?:-(\d+))?\.(png|jpe?g|webp)$/i;
/**
 * The example pictures in `dir` (the repo's `guide/` folder): `squads.png`, or `battle-1.png`, `battle-2.png` for
 * several. Returns a lookup by image name (`battle`: all, in number order; `battle-2`: that one); a missing folder means no pictures.
 */
export function loadPictures(dir) {
    let files = [];
    try {
        files = readdirSync(dir);
    }
    catch {
        files = [];
    }
    const byImage = new Map();
    for (const name of files) {
        const m = PICTURE.exec(name);
        if (!m)
            continue;
        const image = m[1].toLowerCase();
        const list = byImage.get(image) ?? [];
        list.push({ n: Number(m[2] ?? 0), pic: { name, bytes: readFileSync(join(dir, name)) } });
        byImage.set(image, list);
    }
    return (image) => {
        // "battle-2" is that one picture; "battle" all of them
        const one = /^(.+)-(\d+)$/.exec(image);
        const list = byImage.get(one ? one[1] : image) ?? [];
        return list.filter((x) => !one || x.n === Number(one[2])).sort((a, b) => a.n - b.n).map((x) => x.pic).slice(0, 10);
    };
}
//# sourceMappingURL=pictures.js.map