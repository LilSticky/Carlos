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
