import { existsSync } from "node:fs";
import { ConfigError, readConfig, SHEET_SETTINGS } from "./config.js";
import { connect } from "./discord/client.js";
import type { CallSheet } from "./exports/exports.js";
import { MemberList } from "./members/members.js";
import { isOfficer } from "./members/officers.js";
import { callWebApp, createSheet, SheetError } from "./sheet/sheet.js";
import { LinkStore, openDatabase } from "./storage/link-store.js";
import { download, toJpeg } from "./uploads/jpeg.js";
import { MAX_FILE_BYTES } from "./uploads/upload.js";

// Wispbyte writes its panel variables to .env instead of exporting them; exported variables win.
if (existsSync(".env")) process.loadEnvFile(".env");

let config;
try {
  config = readConfig(process.env);
} catch (e) {
  console.error(e instanceof ConfigError ? e.message : e);
  process.exit(1);
}

const db = openDatabase(config.dataDir);
const links = new LinkStore(db);
const sheet = createSheet({ url: config.sheetUrl, secret: config.sheetSecret, fetch: globalThis.fetch });
const memberList = new MemberList(sheet, () => Date.now());
const officerList = new MemberList({ members: () => sheet.officers() }, () => Date.now());
const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

const callSheet: CallSheet = async (key, action, args) => {
  const url = config.sheets[key];
  if (!url) throw new SheetError(`Carlos has no link to this sheet yet (${SHEET_SETTINGS[key]}). Tell an officer.`, true);
  return (await callWebApp({ url, secret: config.sheetSecret, fetch: globalThis.fetch, timeoutMs: 240_000 }, action, { args }))["result"];
};

const client = await connect({
  config,
  memberList,
  iam: { names: () => memberList.fresh(), links, now: () => new Date() },
  upload: {
    memberOf: (id) => links.memberOf(id),
    members: () => memberList.names(),
    download: (a) => download(a.url, MAX_FILE_BYTES),
    toJpeg,
    sheet,
  },
  callSheet,
  isOfficer: (id) => isOfficer(id, { memberOf: (d) => links.memberOf(d), officers: () => officerList.names() }),
  log,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    log(`${signal}: Carlos goes offline.`);
    void client.destroy().finally(() => {
      db.close();
      process.exitCode = 0;
    });
  });
}
