# Command plan

The commands Carlos offers, split by who uses them. Members get a short list of commands that only show
something; each does one thing and needs nothing more typed after it. Leadership gets one command, `/lead`,
with everything else.

## Rules

- **Members never see an option they may not use.** No `post` option, no officer entries in a choice list.
- **`/lead` is hidden from members** with Discord's default member permission (*Manage Roles*, as `/link` has
  today). A server admin can change who sees it under *Server Settings > Integrations > Carlos*. Seeing it is
  not enough: Carlos still checks the rank, and only R4 and R5 on the sheet's member list may use it. Discord
  roles decide only who sees the command.
- **Member commands answer in the channel for everyone** when they only show alliance texts, cards or the farm
  list. Only `/iam`, `/whisper`, `/overlay`, `/me` and `/lead` answer privately. Errors and refusals are always private: a
  failed public command leaves nothing in the channel. When someone else picks from the menu under a `/player`
  card, they get that card privately and the shared one stays as it is.
- **Every command explains itself.** Each command and `/lead` subcommand has an optional `help` option: with
  `help: True` Carlos shows, only to the asker, what the command is for and examples of how to use it. Discord marks
  no option as required, so that `help` works on its own; a command run without what it needs (`/iam` without a
  name, `/whisper` without a picture) shows its help too. `/help` lists all commands; officers also see the `/lead`
  part. The texts are in `src/discord/help.ts`.
- **The guide forum explains it.** Every member command and screenshot kind is described in a post of the
  guide forum (`src/guide/guide.ts`); change it together with the command.
- **Member numbers stay private.** AD scores and donations are shown to the member themselves (`/me`) and to
  officers (`/lead stats`), never to other members.
- **The logic stays in the sheets** (`AGENTS.md`): every command calls an existing sheet action.

## Member commands

| Command | Shows | Sheet action |
|---|---|---|
| `/iam name` | Links your Discord account to your name on the member list (once) | upload `members` |
| `/whisper picture …` | Sends screenshots privately to the Upload Inbox | upload `picture` |
| `/overlay [off]` | Your personal connect code for the overlay app (a button over the game that sends a screenshot), or turns it off | Members `overlayKey`, `overlayRevoke` |
| `/farms` | Untagged players with lots of resources; pick one to attack (cooldown), Gone? Retrace finds where it went | Members `farms`, `hit`, `retrace` |
| `/me` | Your own card: this week's AD scores, donations, when you drive or guard | Coachman `search` for your linked name |
| `/player name` | A player's combat card: squads, strength, intel from reports (members and other alliances) | Statistics `card`, `people` for autocomplete |
| `/whois name\|uid [kingdom]` | Any player of the game from the Last Asylum Tracker: Might, alliance and rank, location; a pick list when several share the name | Members `trackerPlayer` |
| `/alliance search [kingdom]` | An alliance by tag or full name (our Kingdom by default) with its members by rank; a menu shows a member's card privately | Members `trackerAlliance` |
| `/rotation` | This week's coachman schedule, for everyone in the channel; while it is a draft, only that it is still being planned. Not `/schedule`: Discord's own command of that name hides an app's. | Coachman `schedule` |
| `/faq topic` | A reference text to read, only to the asker: the driver guide or the house rules | Coachman `guide`, `rules` |
| `/help [command]` | These commands in plain words; officers also see the `/lead` part. With a command: how it works, with examples (the same as that command's `help: True`) | none |

Screenshots in the upload channel stay as they are; they need no command. Neither do the R4 and R5 ranking
recordings in the video inbox (`VIDEO_CHANNEL_ID`): Carlos sends them to the Upload Inbox (Members `kinds`,
`recording`, `part`) and asks with a menu which ranking a video shows when the post does not say.

## Leadership: `/lead`

Every command that makes a message to post (schedule (members read it with `/rotation`), daily message, events, AD notice, Elixir teams, KvK roster) is
here, not with the member commands.

| Subcommand | Does | Sheet action |
|---|---|---|
| `/lead text what` | An alliance message only to the officer, in a code block to copy into the game. `what`: schedule, today, rules, driverguide, events, ad today, ad tomorrow, elixir, kvk | Coachman `schedule`, `daily`, `rules`, `guide`; Events `week`, `ad` (offset 0 or 1), `elixir`; KvK `roster` |
| `/lead post what` | Posts the same messages in the announcement channel (`ANNOUNCE_CHANNEL_ID`) with @here. Posting the schedule locks it in. | as above |
| `/lead link user name` | Sets which member a Discord account is | upload `members` |
| `/lead driver` | The driver reminder to send on | Coachman `driver` |
| `/lead notice` | The nominee notice | Coachman `notice` |
| `/lead vote which` | The vote list: `nominees` or `guards` | Statistics `votes`, `guards` |
| `/lead stats name` | All numbers of one member | Statistics `stats` |
| `/lead siege` | Makes the Undead Siege defense plan now and posts it in this channel (Carlos also posts the invitation and the plan by itself in `ANNOUNCE_CHANNEL_ID`) | Undead Siege `next`, `plan` |
| `/lead auto …` | *Later:* switch the daily caravan post and the driver DMs on or off and pick the channel | new |

## Build slices

1. ✅ **The split.** Friendlier member commands, the `post` option and officer entries removed, `/lead` with
   `post`, `link`, `driver`, `notice`, `vote` and `stats`; `/farms`. `/coachman`, `/vote`, `/link` and the
   top-level `/stats` are gone. `/player` shows the combat card (built alongside).
2. **`/me`.** Your own AD scores, donations and duties. No sheet change: Coachman `search` exists.
3. ✅ **`/help`** and the `help` option on every command. Texts in `src/discord/help.ts`.
4. **`/lead auto`** with the scheduled posts: the daily caravan message is ✅ automatic (three hours before set-up,
   in the announcement channel, the driver mentioned); still to come: the driver reminder DM and a switch for both.
