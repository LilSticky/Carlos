import { z } from "zod";

/**
 * Alliance Members, reached through the doPost of its web app (rebirth-sheets members/Bot.js, the upload actions
 * in members/BotActions.js and members/Uploads.js): the member and officer lists, and the screenshots and
 * recordings members post in Discord, the only way into its Upload Inbox. Every answer is HTTP 200 with
 * { ok, ... } or { ok: false, error }: a web app cannot set a status code. fetch follows the web app's redirect to script.googleusercontent.com as a GET, which is what
 * Apps Script expects.
 */
export interface Sheet {
  /** Member names from the Members tab, sorted. */
  members(): Promise<string[]>;
  /** R4 and R5 names. */
  officers(): Promise<string[]>;
  /**
   * One picture (JPEG) of one upload, in order index 0 .. count - 1, all with the same uploadId. Returns the
   * member name as written in the sheet.
   */
  sendPicture(picture: PictureToSend): Promise<string>;
  /** What a ranking recording can show (RECORDINGS of Alliance Members). */
  kinds(): Promise<RecordingKind[]>;
  /** Opens a recording's row in the Upload Inbox; the member must be R4 or R5. */
  startRecording(recording: RecordingToSend): Promise<RecordingStart>;
  /** One part of the video, in order 0 .. parts - 1, each `partBytes` long but the last. */
  sendPart(id: string, index: number, bytes: Uint8Array): Promise<void>;
}

export interface RecordingKind {
  readonly key: string;
  readonly label: string;
}

export interface RecordingToSend {
  readonly member: string;
  readonly kind: string;
  readonly size: number;
  readonly mime: string;
}

export interface RecordingStart {
  readonly id: string;
  readonly parts: number;
  readonly partBytes: number;
  /** The member as written in the sheet. */
  readonly name: string;
}

export interface PictureToSend {
  readonly member: string;
  readonly uploadId: string;
  readonly index: number;
  readonly count: number;
  readonly jpeg: Uint8Array;
}

/** The sheet refused or could not be reached. The message is fit to show to the member. */
export class SheetError extends Error {
  constructor(
    message: string,
    /** True when the fault is Carlos's setup (secret, link), so an officer must act. */
    readonly setup = false,
  ) {
    super(message);
    this.name = "SheetError";
  }
}

export const NOT_CONNECTED =
  "Carlos is not connected to the alliance sheet (SHEET_SECRET does not match the sheet's BOT_SECRET). Tell an officer.";

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

function readable<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
  return parsed.data;
}

export interface SheetOptions {
  readonly url: string;
  readonly secret: string;
  readonly fetch: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

/**
 * One call to a sheet's web app: { secret, action, ...extra } as JSON. Returns the answer when ok, else throws a
 * SheetError with the sheet's own text (or a setup problem). Bot.js in the sheets takes { action, args } and
 * answers { ok, result }.
 */
export async function callWebApp(
  options: SheetOptions,
  action: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  let res: Response;
  try {
    res = await options.fetch(options.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: options.secret, action, ...extra }),
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new SheetError("The alliance sheet did not answer. Please try again in a few minutes.");
  }
  if (!res.ok) throw new SheetError(`The alliance sheet answered with an error (HTTP ${res.status}). Please try again later.`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new SheetError("The alliance sheet sent an answer Carlos cannot read. Is its link the /exec link?", true);
  }
  const parsed = answer.safeParse(body);
  if (!parsed.success) throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
  if (!parsed.data.ok) {
    const error = (parsed.data as { error: string }).error;
    if (error === "Not allowed.") throw new SheetError(NOT_CONNECTED, true);
    throw new SheetError(error);
  }
  return parsed.data;
}

export function createSheet(options: SheetOptions): Sheet {
  /** One Bot.js action of Alliance Members; returns its result. */
  async function call(action: string, args: Record<string, unknown> = {}, timeoutMs?: number): Promise<Record<string, unknown>> {
    const body = await callWebApp(timeoutMs ? { ...options, timeoutMs } : options, action, { args });
    const result = body["result"];
    if (!result || typeof result !== "object") throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
    return result as Record<string, unknown>;
  }

  async function list(action: string, field: string): Promise<string[]> {
    const parsed = names.safeParse((await call(action))[field]);
    if (!parsed.success) throw new SheetError("The alliance sheet sent an answer Carlos cannot read.", true);
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
