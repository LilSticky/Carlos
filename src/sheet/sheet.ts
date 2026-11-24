import { z } from "zod";

/**
 * The alliance sheet, reached through the doPost of the "Alliance upload" web app (rebirth-sheets,
 * upload/Code.js). Every answer is HTTP 200 with { ok, ... } or { ok: false, error }: a web app cannot set a
 * status code. fetch follows the web app's redirect to script.googleusercontent.com as a GET, which is what
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

export interface SheetOptions {
  readonly url: string;
  readonly secret: string;
  readonly fetch: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

/**
 * One call to a sheet's web app: { secret, action, ...extra } as JSON. Returns the answer when ok, else throws a
 * SheetError with the sheet's own text (or a setup problem). Used by the upload web app and by Bot.js in the sheets.
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
  const call = (action: string, extra: Record<string, unknown> = {}) => callWebApp(options, action, extra);

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
  };
}
