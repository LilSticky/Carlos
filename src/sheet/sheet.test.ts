import { describe, expect, it } from "vitest";
import { createSheet, NOT_CONNECTED, SheetError } from "./sheet.js";

const URL_ = "https://script.google.com/macros/s/abc/exec";
const SECRET = "a-secret-that-is-long-enough";

function fakeFetch(reply: (body: Record<string, unknown>) => Response | Promise<Response>) {
  const calls: Record<string, unknown>[] = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe(URL_);
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push(body);
    return reply(body);
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });

describe("sheet", () => {
  it("lists the members, sending the secret", async () => {
    const f = fakeFetch(() => json({ ok: true, members: ["Alpha", "Bravo"] }));
    const sheet = createSheet({ url: URL_, secret: SECRET, fetch: f.fetch });
    expect(await sheet.members()).toEqual(["Alpha", "Bravo"]);
    expect(f.calls).toEqual([{ secret: SECRET, action: "members" }]);
  });

  it("lists the officers", async () => {
    const f = fakeFetch(() => json({ ok: true, officers: ["Alpha"] }));
    expect(await createSheet({ url: URL_, secret: SECRET, fetch: f.fetch }).officers()).toEqual(["Alpha"]);
  });

  it("sends a picture as base64 and returns the name as the sheet writes it", async () => {
    const f = fakeFetch(() => json({ ok: true, member: "Alpha" }));
    const sheet = createSheet({ url: URL_, secret: SECRET, fetch: f.fetch });
    const member = await sheet.sendPicture({ member: "alpha", uploadId: "dc-123456789", index: 0, count: 2, jpeg: new Uint8Array([0xff, 0xd8, 1]) });
    expect(member).toBe("Alpha");
    expect(f.calls[0]).toEqual({ secret: SECRET, action: "picture", name: "alpha", uploadId: "dc-123456789", index: 0, count: 2, b64: "/9gB" });
  });

  it("passes the sheet's own error text on", async () => {
    const f = fakeFetch(() => json({ ok: false, error: "Many uploads right now. Please try again in an hour." }));
    await expect(createSheet({ url: URL_, secret: SECRET, fetch: f.fetch }).members()).rejects.toThrow(
      new SheetError("Many uploads right now. Please try again in an hour."),
    );
  });

  it("calls a refused secret a setup problem", async () => {
    const f = fakeFetch(() => json({ ok: false, error: "Not allowed." }));
    const error = await createSheet({ url: URL_, secret: SECRET, fetch: f.fetch }).members().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SheetError);
    expect((error as SheetError).message).toBe(NOT_CONNECTED);
    expect((error as SheetError).setup).toBe(true);
  });

  it("calls an HTML answer (a wrong link) a setup problem", async () => {
    const f = fakeFetch(() => new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } }));
    const error = await createSheet({ url: URL_, secret: SECRET, fetch: f.fetch }).members().catch((e: unknown) => e);
    expect((error as SheetError).setup).toBe(true);
  });

  it("says when the sheet cannot be reached", async () => {
    const fetch = (async () => {
      throw new TypeError("network down");
    }) as typeof globalThis.fetch;
    await expect(createSheet({ url: URL_, secret: SECRET, fetch }).members()).rejects.toThrow(/did not answer/);
  });

  it("says when the sheet answers with an HTTP error", async () => {
    const f = fakeFetch(() => new Response("busy", { status: 503 }));
    await expect(createSheet({ url: URL_, secret: SECRET, fetch: f.fetch }).members()).rejects.toThrow(/HTTP 503/);
  });
});
