# Carlos

Carlos, the Alliance Attendant, is the Discord bot for **one** alliance in Last Asylum: Plague. It brings the
alliance's Google Sheets (rebirth-sheets: Alliance Members, Coachman Express and the others) into the
alliance's Discord server. It is built like Neil (TypeScript, discord.js, zod, node:sqlite, vitest), but
for a single alliance with only a few channels.

## What it does now

- **/iam `name`**: a member picks their name from the alliance member list (autocomplete). Carlos keeps the
  link in its own database. The sheets never store Discord IDs.
- **/link `user` `name`** (members with *Manage Roles*): an officer sets or moves the link.
- **Screenshots in the upload channel**: a member posts up to 10 pictures in one message. Carlos turns them
  into JPEGs like the upload page does (longest edge 2400 px, quality 88) and sends them as **one** upload
  to the Upload Inbox of Alliance Members. From there, the existing AI pipeline reads them every 10 minutes.
  ⏳ while it works, then ✅ or ❌ and a reply.
- **/whisper `picture` … `picture10`**: the same upload, but private. It works in any channel, and only the
  sender sees the pictures and Carlos's answer. The officers find the upload in the Upload Inbox as usual.

- **/player `name`**: the Coachman Express's player search. Shows the best match with its AD scores,
  donations, squads and coachman duties, and names the other matches. Only R4 and R5 see the officers' notes.
- **/coachman**, **/events**, **/kvk**, **/vote**: the texts the sheets' menus export, such as the schedule,
  the daily message, the AD notice, the KvK roster and the vote lists. They are shown only to whoever asks,
  with in-game texts in code blocks so they copy cleanly. With `post`, an R4 or R5 posts the text in the
  channel instead. Members never see a draft schedule, and posting the schedule locks it in, like its first
  export.
- **Officers** are the members ranked R4 or R5 on the member list in the sheet, linked with /iam. Discord
  roles play no part.

## How it reaches the sheets

Every sheet has its own web app, and Carlos sends `{ secret, action, ... }` to it as JSON:

- the *Alliance upload* web app (rebirth-sheets `upload/Code.js`, `SHEET_URL`) for the member and officer
  lists and the pictures;
- `Bot.js` with its `BotActions.js` in Coachman Express, Event Calendar, KvK Planning and Alliance
  Statistics (`COACHMAN_URL`, `EVENTS_URL`, `KVK_URL`, `STATS_URL`) for search and exports. A sheet without
  a link has no commands.

Each web app answers `{ ok, ... }` and only to a request that carries its `BOT_SECRET` script property. That
is the same text in every sheet, and Carlos's `SHEET_SECRET`. The sheets build every text themselves; Carlos
only fetches it.

## Setup

1. **Discord developer portal**: create the application *Carlos*. Under *Bot*, switch on **Message Content
   Intent**, because Carlos has to see the attachments. Invite it with the scopes `bot` and
   `applications.commands` and the permissions *View Channel*, *Send Messages*, *Read Message History* and
   *Add Reactions*.
2. **Upload web app**: add the script property `BOT_SECRET` (24 characters or more, random), push and
   update the existing deployment (`upload/MAINTENANCE.md`).
3. **Settings**: copy `env.example` to `.env` locally, or set the same variables in the Wispbyte panel.
4. `npm ci`, `npm run build`, `npm start`. The slash commands are registered on the alliance server at
   every start.

## Hosting on Wispbyte

Every green push to `main` makes CI add one commit to the `deploy` branch, which holds only `dist/`, the runtime
`package.json` and lockfile, and `build-info.json`. The server pulls it on every start.

**Startup** settings:

| Field | Value |
|---|---|
| Git Repo Address | `https://github.com/LilSticky/Carlos` |
| Install Branch | `deploy` |
| User Uploaded Files | `0` |
| Auto Update | `1` |
| JS file | `dist/main.js` |
| Git Username / Git Access Token | empty (the repository is public) |

**Environment**: the variables of `env.example`. Wispbyte keeps them in `.env` in the server folder rather than
exporting them, and Carlos reads that file at startup. Never delete `.env` in the file manager. If it is gone,
create it there with one `NAME=value` line per variable.

**First clone.** Wispbyte won't start an empty folder, and *Reinstall* does not clone. So once, in **Files**:
delete everything except `.env`, create `dist/main.js` with the following content, start the server, wait for `Bootstrap done`,
then restart.

```js
// One-time Wispbyte bootstrap: turns the server folder into a checkout of the deploy branch.
const { execFileSync } = require("node:child_process");
const { rmSync } = require("node:fs");
const git = (...args) => execFileSync("git", args, { stdio: "inherit" });
rmSync("dist", { recursive: true, force: true });
git("init", "-q");
git("remote", "add", "origin", "https://github.com/LilSticky/Carlos");
git("fetch", "-q", "origin", "deploy");
git("checkout", "-q", "-b", "deploy", "--track", "origin/deploy");
console.log("Bootstrap done: restart the server.");
```

## Develop

```powershell
npm test
```
```powershell
npm run typecheck
```
