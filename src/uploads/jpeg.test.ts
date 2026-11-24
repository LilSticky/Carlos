import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_EDGE, toJpeg } from "./jpeg.js";

describe("toJpeg", () => {
  it("turns a big transparent PNG into a JPEG no longer than 2400 pixels", async () => {
    const png = await sharp({ create: { width: 1200, height: 3000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    const jpeg = await toJpeg(png);
    expect([jpeg[0], jpeg[1]]).toEqual([0xff, 0xd8]); // what the sheet checks
    const meta = await sharp(jpeg).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.height).toBe(MAX_EDGE);
    expect(meta.width).toBe(960);
  });

  it("keeps a small picture at its size", async () => {
    const png = await sharp({ create: { width: 300, height: 600, channels: 3, background: "#123456" } }).png().toBuffer();
    expect((await sharp(await toJpeg(png)).metadata()).width).toBe(300);
  });

  it("refuses a file that is no picture", async () => {
    await expect(toJpeg(new TextEncoder().encode("not a picture"))).rejects.toThrow();
  });
});
