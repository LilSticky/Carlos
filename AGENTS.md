# Carlos Agent Instructions

Carlos is the Discord bot of one alliance in Last Asylum: Plague. It brings the rebirth-sheets
spreadsheets into Discord. Start with `README.md`.

- **The logic stays in the sheets.** Carlos calls the sheets' web apps and shows what they answer. It
  never copies sheet logic. A new feature first gets an action in the sheet's `doPost`, then a command here.
- **Personal data**: Carlos may store which Discord account is which member (in-game name). Nothing else
  about members, and never in the sheets or in code. No real member names in tests or texts: use
  placeholders like Alpha and Bravo.
- **Texts** members see live in `src/discord/texts.ts`. Use the game terms as rebirth-sheets uses them.
- **Tests first** for everything outside `src/discord/client.ts` and `src/main.ts`, which only wire things
  together. `npm test` and `npm run typecheck` must pass.
- Secrets live in `.env` or the Wispbyte panel, never in the repository.
- **Keep the guide forum current.** Every change to what members can do updates the guide posts in
  `src/guide/guide.ts` in the same commit: a new or changed member command through its `/help` entry (the test
  fails for a command no post explains), a new screenshot kind of Alliance Members (REPORT_PROMPT in
  rebirth-sheets `members/Inbox.js`) as an entry in `SCREENSHOT_KINDS`, a new public feature as a post or section.
  Carlos edits the posts on the next start.
