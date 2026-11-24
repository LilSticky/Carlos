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
export const NOT_CONNECTED = "Carlos is not connected to the alliance sheet (SHEET_SECRET does not match the sheet's BOT_SECRET). Tell an officer.";
const answer = z.union([
    z.object({ ok: z.literal(true) }).loose(),
    z.object({ ok: z.literal(false), error: z.string() }),
]);
const names = z.array(z.string());
const kindList = z.array(z.object({ key: z.string().min(1), label: z.string().min(1) }));
const recordingStart = z.object({
    id: z.string().min(1),
    parts: z.number().int().positive(),
    partBytes: z.number().int().positive(),
    name: z.string().min(1),
});
function readable(schema, value) {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
        throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
    return parsed.data;
}
/**
 * One call to a sheet's web app: { secret, action, ...extra } as JSON. Returns the answer when ok, else throws a
 * SheetError with the sheet's own text (or a setup problem). Bot.js in the sheets takes { action, args } and
 * answers { ok, result }.
 */
export async function callWebApp(options, action, extra = {}) {
    const timeoutMs = options.timeoutMs ?? 90_000;
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
        throw new SheetError("The alliance sheet sent an answer Carlos cannot read. Is its link the /exec link?", true);
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
export function createSheet(options) {
    /** One Bot.js action of Alliance Members; returns its result. */
    async function call(action, args = {}, timeoutMs) {
        const body = await callWebApp(timeoutMs ? { ...options, timeoutMs } : options, action, { args });
        const result = body["result"];
        if (!result || typeof result !== "object")
            throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
        return result;
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
        async kinds() {
            return readable(kindList, (await call("kinds"))["kinds"]);
        },
        async startRecording(r) {
            const body = await call("recording", { name: r.member, kind: r.kind, size: r.size, mime: r.mime });
            return readable(recordingStart, body);
        },
        async sendPart(id, index, bytes) {
            // a part is 8 MiB: the sheet takes a minute at most, but give it room
            await call("part", { id, index, b64: Buffer.from(bytes).toString("base64") }, options.timeoutMs ?? 300_000);
        },
    };
}
//# sourceMappingURL=sheet.js.map