# Carlos

Carlos, the Alliance Attendant, is the Discord bot for **one** alliance in Last Asylum: Plague. It brings the
alliance's Google Sheets (rebirth-sheets: Alliance Members, Coachman Express and the others) into the
alliance's Discord server. It is built like Neil (TypeScript, discord.js, zod, node:sqlite, vitest), but
for a single alliance with only a few channels.

## What it does now

The full command plan, with who sees what, is in `COMMANDS.md`.

**For every member**, each command shows one thing, only to whoever asks:

- **/iam `name`**: a member picks their name from the alliance member list (autocomplete). Carlos keeps the
  link in its own database. The sheets never store Discord IDs.
- **Screenshots in the upload channel**: a member posts up to 10 pictures in one message. Carlos turns them
  into JPEGs like the upload page does (longest edge 2400 px, quality 88) and sends them as **one** upload
  to the Upload Inbox of Alliance Members. From there, the existing AI pipeline reads them every 10 minutes.
  ⏳ while it works, then ✅ or ❌ and a reply. A failure a second try can fix (not linked with /iam yet,
  the sheet busy) gets a **Retry** button: only the sender can press it, and the post need not be repeated.
- **/whisper `picture` … `picture10`**: the same upload, but private. It works in any channel, and only the
  sender sees the pictures and Carlos's answer. The officers find the upload in the Upload Inbox as usual.
- **Recordings in the video inbox** (`VIDEO_CHANNEL_ID`, R4 and R5 only): a screen recording of an event's
  ranking, posted as a video. Carlos sends it to the Upload Inbox as a recording, like the recording page
  but without the officer code (the /iam link vouches for the poster). When the post's text names the ranking
  (`hunt`, `Cheese Trap`, `AD`, `KvK`), it goes at once; else Carlos asks with a menu of the kinds the sheet
  can read, which any R4 or R5 may answer. *No import for this event yet* puts it off: Carlos asks again on a
  start after the sheet has learned a new kind. *Leave it* skips it. On every start Carlos looks through the
  channel's last 100 posts for videos it has not handled yet. One video per post.
- **/player `name`**: a player's combat card from Alliance Statistics, for members and players seen in
  reports. No AD scores, donations or other member numbers.
- **/farms**: players without an alliance tag with lots of resources, from scout reports. Pick the one you
  attack: it goes on cooldown under your name. Not there any more? **Gone? Retrace** asks the tracker where it went.
- **/rotation**: this week's coachman schedule as a card, set-up times in each reader's own time, for everyone in the channel (a draft stays hidden from
  members). Not /schedule, because Discord's own /schedule hides an app's command of that name.
- **/faq** `topic`: the driver guide or the house rules, only to the asker. The alliance messages (schedule,
  daily message, events, AD notice, Elixir teams, KvK roster) are for R4 and R5: **/lead text** and **/lead post**.
- **The guide forum** (`GUIDE_FORUM_ID`): one forum post per topic that explains Carlos to members: how to
  send screenshots, which screens Carlos can read (each with example pictures from `guide/`), the cards, farms,
  texts and the Undead Siege. The texts live in `src/guide/guide.ts` and reuse the /help texts. On every start
  Carlos compares each post with what it posted last time and edits only the ones that changed, so a new
  version updates the forum by itself. "Start here" is pinned on top. Officer features are left out.

**For R4 and R5**, everything is under **/lead**: `post` (a member text in the channel for everyone; posting
the schedule locks it in, like its first export), `link` (set which member a Discord account is), `driver`,
`notice`, `vote` and `stats` (a member's full numbers).

**Officers** are the members ranked R4 or R5 on the member list in the sheet, linked with /iam. Discord shows
/lead only to members who may manage roles (a server admin can change that under *Server Settings >
Integrations > Carlos*), but that only hides it: Carlos checks the rank on the sheet every time.

## How it reaches the sheets

Every sheet has its own web app, and Carlos sends `{ secret, action, ... }` to it as JSON:

- `Bot.js` in Alliance Members (`MEMBERS_URL`, required) for the member and officer lists, the screenshots
  and the ranking recordings (its `members/Uploads.js`; Discord is the only way into the Upload Inbox), and
  the farms;
- `Bot.js` with its `BotActions.js` in Coachman Express, Event Calendar, KvK Planning and Alliance
  Statistics (`COACHMAN_URL`, `EVENTS_URL`, `KVK_URL`, `STATS_URL`) for search and exports. A sheet without a link has no commands.
- `Bot.js` in the Undead Siege sheet (`SIEGE_URL`): Carlos posts the invitation with its Participate and Stay
  out buttons before each siege of the Event Calendar, signs up (or off) whoever presses them (their `/iam` name)
  and posts the defense plan before the start, mentioning the members who send squads. `/lead siege` makes and
  posts the plan at any time.
- KvK Planning (`KVK_URL`, actions `kvkNext`, `kvkAnswer`, `kvkReadiness`): before each Day VI battle Carlos posts
  the KvK vote card with Participate and Stay out. Answers go into the sheet's Discord Votes tab and win over the
  imported in-game vote. When Day VI starts the card closes and Carlos posts the KvK Readiness card.
- Coachman Express (`COACHMAN_URL`, action `daily`): three hours before each day's set-up Carlos posts that day's
  caravan card (driver, guard, set-up and boarding as Discord timestamps) in the announcement channel, without `@here`, and mentions the driver when their account is
  linked with /iam. Once a day; a restart does not post it again.
- All invitation cards, votes and `/lead post` announcements go to the announcement channel (`ANNOUNCE_CHANNEL_ID`)
  with `@here`. Carlos needs the permission *Mention @everyone, @here and All Roles* there.

Each web app answers `{ ok, ... }` and only to a request that carries its `BOT_SECRET` script property. That
is the same text in every sheet, and Carlos's `SHEET_SECRET`. The sheets build every text themselves; Carlos
only fetches it.

## Setup

1. **Discord developer portal**: create the application *Carlos*. Under *Bot*, switch on **Message Content
   Intent**, because Carlos has to see the attachments. Invite it with the scopes `bot` and
   `applications.commands` and the permissions *View Channel*, *Send Messages*, *Read Message History* and
   *Add Reactions*. For the guide forum also *Create Posts* and *Manage Threads* in that forum (to pin
   "Start here" and reopen archived posts). Forum tags named *Start here*, *Screenshots*, *Commands* and
   *Events* are applied when the forum has them.
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
