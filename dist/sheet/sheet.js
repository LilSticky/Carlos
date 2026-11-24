import { z } from "zod";
/** The sheet refused or could not be reached. The message is fit to show to the member. */
export class SheetError extends Error {
    setup;
    constructor(message, 
    /** True when the fault is Carlos's setup (secret, link), so an officer must act. */
    setup = false) {
        super(message);
        this.setup = setup;
        this.name = "SheetError";
    }
}
export const NOT_CONNECTED = "Carlos is not connected to the alliance sheet (SHEET_SECRET does not match the BOT_SECRET of the upload web app). Tell an officer.";
const answer = z.union([
    z.object({ ok: z.literal(true) }).loose(),
    z.object({ ok: z.literal(false), error: z.string() }),
]);
const names = z.array(z.string());
export function createSheet(options) {
    const timeoutMs = options.timeoutMs ?? 90_000;
    async function call(action, extra = {}) {
        let res;
        try {
            res = await options.fetch(options.url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ secret: options.secret, action, ...extra }),
                redirect: "follow",
                signal: AbortSignal.timeout(timeoutMs),
            });
        }
        catch {
            throw new SheetError("The alliance sheet did not answer. Please try again in a few minutes.");
        }
        if (!res.ok)
            throw new SheetError(`The alliance sheet answered with an error (HTTP ${res.status}). Please try again later.`);
        let body;
        try {
            body = await res.json();
        }
        catch {
            throw new SheetError("The alliance sheet sent an answer Carlos cannot read. Is SHEET_URL the /exec link?", true);
        }
        const parsed = answer.safeParse(body);
        if (!parsed.success)
            throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
        if (!parsed.data.ok) {
            const error = parsed.data.error;
            if (error === "Not allowed.")
                throw new SheetError(NOT_CONNECTED, true);
            throw new SheetError(error);
        }
        return parsed.data;
    }
    async function list(action, field) {
        const parsed = names.safeParse((await call(action))[field]);
        if (!parsed.success)
            throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
        return parsed.data;
    }
    return {
        members: () => list("members", "members"),
        officers: () => list("officers", "officers"),
        async sendPicture(p) {
            const body = await call("picture", {
                name: p.member,
                uploadId: p.uploadId,
                index: p.index,
                count: p.count,
                b64: Buffer.from(p.jpeg).toString("base64"),
            });
            return typeof body["member"] === "string" ? body["member"] : p.member;
        },
    };
}
//# sourceMappingURL=sheet.js.map