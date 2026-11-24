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
- **Member numbers stay private.** AD scores and donations are shown to the member themselves (`/me`) and to
  officers (`/lead stats`), never to other members.
- **The logic stays in the sheets** (`AGENTS.md`): every command calls an existing sheet action.

## Member commands

| Command | Shows | Sheet action |
|---|---|---|
| `/iam name` | Links your Discord account to your name on the member list (once) | upload `members` |
| `/whisper picture …` | Sends screenshots privately to the Upload Inbox | upload `picture` |
| `/farms` | Untagged players with lots of resources; pick one to attack (cooldown), Gone? Retrace finds where it went | Members `farms`, `hit`, `retrace` |
| `/me` | Your own card: this week's AD scores, donations, when you drive or guard | Coachman `search` for your linked name |
| `/player name` | A player's combat card: squads, strength, intel from reports (members and other alliances) | Statistics `card`, `people` for autocomplete |
| `/schedule` | This week's coachman schedule (not while it is a draft) | Coachman `schedule` |
| `/today` | Today's caravan message | Coachman `daily` |
| `/rules` | The house rules | Coachman `rules` |
| `/driverguide` | The driver guide | Coachman `guide` |
| `/events` | This week's events | Events `week` |
| `/ad [tomorrow]` | The AD notice for today, or for tomorrow | Events `ad` (offset 0 or 1) |
| `/elixir` | The Elixir Scramble teams | Events `elixir` |
| `/kvk` | Who comes to the KvK battle | KvK `roster` |
| `/help` | These commands in plain words; officers also see the `/lead` part | none |

Screenshots in the upload channel stay as they are; they need no command.

## Leadership: `/lead`

| Subcommand | Does | Sheet action |
|---|---|---|
| `/lead post what` | Posts a member text in this channel for everyone. `what`: schedule, today, rules, driverguide, events, ad today, ad tomorrow, elixir, kvk. Posting the schedule locks it in. | as above |
| `/lead link user name` | Sets which member a Discord account is | upload `members` |
| `/lead driver` | The driver reminder to send on | Coachman `driver` |
| `/lead notice` | The nominee notice | Coachman `notice` |
| `/lead vote which` | The vote list: `nominees` or `guards` | Statistics `votes`, `guards` |
| `/lead stats name` | All numbers of one member | Statistics `stats` |
| `/lead auto …` | *Later:* switch the daily caravan post and the driver DMs on or off and pick the channel | new |

## Build slices

1. ✅ **The split.** Friendlier member commands, the `post` option and officer entries removed, `/lead` with
   `post`, `link`, `driver`, `notice`, `vote` and `stats`; `/farms`. `/coachman`, `/vote`, `/link` and the
   top-level `/stats` are gone. `/player` shows the combat card (built alongside).
2. **`/me`.** Your own AD scores, donations and duties. No sheet change: Coachman `search` exists.
3. **`/help`.** Texts in `src/discord/texts.ts`.
4. **`/lead auto`** with the scheduled posts (daily caravan message, driver reminder DM).
