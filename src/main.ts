import { existsSync } from "node:fs";
import { PeopleList, readPeople } from "./cards/people.js";
import { ConfigError, readConfig, SHEET_SETTINGS } from "./config.js";
import { connect } from "./discord/client.js";
import type { CallSheet } from "./exports/exports.js";
import { MemberList } from "./members/members.js";
import { isOfficer } from "./members/officers.js";
import { callWebApp, createSheet, SheetError } from "./sheet/sheet.js";
import { LinkStore, openDatabase } from "./storage/link-store.js";
import { GuideStore } from "./storage/guide-store.js";
import { guidePosts } from "./guide/guide.js";
import { loadPictures } from "./guide/pictures.js";
import { SiegeStore } from "./storage/siege-store.js";
import { KvkStore } from "./storage/kvk-store.js";
import { DailyStore } from "./storage/daily-store.js";
import { VideoStore } from "./storage/video-store.js";
import type { RecordingKind } from "./sheet/sheet.js";
import { MAX_VIDEO_BYTES } from "./recordings/recording.js";
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
const sheet = createSheet({ url: config.sheets.members, secret: config.sheetSecret, fetch: globalThis.fetch });
const memberList = new MemberList(sheet, () => Date.now());
const officerList = new MemberList({ members: () => sheet.officers() }, () => Date.now());
const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

const callSheet: CallSheet = async (key, action, args) => {
  const url = config.sheets[key];
  if (!url) throw new SheetError(`Carlos has no link to this sheet yet (${SHEET_SETTINGS[key]}). Tell an officer.`, true);
  return (await callWebApp({ url, secret: config.sheetSecret, fetch: globalThis.fetch, timeoutMs: 240_000 }, action, { args }))["result"];
};

const people = new PeopleList(async () => (config.sheets.stats ? readPeople(await callSheet("stats", "people", {})) : []), () => Date.now());
void people.refresh().catch((e: unknown) => log(`Player list not loaded: ${String(e)}`));

// the kinds a recording can show change only when Alliance Members is deployed again
let kindsCache: { kinds: RecordingKind[]; at: number } | undefined;
const recordingKinds = async () => {
  if (!kindsCache || Date.now() - kindsCache.at > 10 * 60_000) kindsCache = { kinds: await sheet.kinds(), at: Date.now() };
  return kindsCache.kinds;
};
const officerOfId = (id: string) => isOfficer(id, { memberOf: (d) => links.memberOf(d), officers: () => officerList.names() });

const client = await connect({
  config,
  memberList,
  people,
  iam: { names: () => memberList.fresh(), links, now: () => new Date() },
  upload: {
    memberOf: (id) => links.memberOf(id),
    members: () => memberList.names(),
    download: (a) => download(a.url, MAX_FILE_BYTES),
    toJpeg,
    sheet,
  },
  callSheet,
  isOfficer: officerOfId,
  ...(config.videoChannelId
    ? {
        video: {
          channelId: config.videoChannelId,
          recording: {
            memberOf: (id: string) => links.memberOf(id),
            officers: () => officerList.names(),
            download: (a: { url: string }) => download(a.url, MAX_VIDEO_BYTES, globalThis.fetch, 600_000),
            sheet,
          },
          kinds: recordingKinds,
          store: new VideoStore(db),
          isOfficer: officerOfId,
          now: () => new Date(),
          log,
        },
      }
    : {}),
  ...(config.sheets.siege
    ? {
        siege: {
          callSheet,
          store: new SiegeStore(db),
          channelId: config.announceChannelId,
          memberOf: (id: string) => links.memberOf(id),
          discordOf: (member: string) => links.holderOf(member, ""),
          now: () => new Date(),
          log,
        },
      }
    : {}),
  ...(config.sheets.kvk
    ? {
        kvk: {
          callSheet,
          store: new KvkStore(db),
          channelId: config.announceChannelId,
          memberOf: (id: string) => links.memberOf(id),
          now: () => new Date(),
          log,
        },
      }
    : {}),
  ...(config.sheets.coachman
    ? {
        daily: {
          callSheet,
          store: new DailyStore(db),
          channelId: config.announceChannelId,
          discordOf: (member: string) => links.holderOf(member, ""),
          now: () => new Date(),
          log,
        },
      }
    : {}),
  ...(config.guideForumId
    ? {
        guide: {
          forumId: config.guideForumId,
          posts: guidePosts({
            sheets: config.sheets,
            uploadChannelId: config.uploadChannelId,
            announceChannelId: config.announceChannelId,
          }),
          pictures: loadPictures("guide"),
          store: new GuideStore(db),
          log,
        },
      }
    : {}),
  log,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    log(`${signal}: Carlos goes offline.`);
    void client.destroy().finally(() => {
      db.close();
      // timers (the siege board) and open requests would keep Node running, and Wispbyte waits for the exit
      process.exit(0);
    });
  });
}
