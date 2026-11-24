import sharp from "sharp";
/** The same as the upload page: longest edge 2400 pixels, JPEG quality 88, black behind transparency. */
export const MAX_EDGE = 2400;
export const QUALITY = 88;
export async function toJpeg(bytes) {
    return sharp(bytes, { failOn: "error", animated: false })
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#000000" })
        .jpeg({ quality: QUALITY })
        .toBuffer();
}
/** Downloads a Discord attachment, refusing anything bigger than `maxBytes`. */
export async function download(url, maxBytes, fetch = globalThis.fetch) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok)
        throw new Error(`download failed: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > maxBytes)
        throw new Error("file too big");
    return bytes;
}
//# sourceMappingURL=jpeg.js.map