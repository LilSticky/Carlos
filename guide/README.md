# Example pictures for the guide forum

Carlos attaches these to the posts in the guide forum (`GUIDE_FORUM_ID`, texts in `src/guide/guide.ts`). Name a
picture after the screenshot kind it shows: `squads.png`, or `battle-1.png`, `battle-2.png` … for several (up to 10,
in number order). PNG, JPEG or WebP, each under 8 MB.

Kinds: `squads`, `hero`, `roster`, `barracks`, `epigraph`, `battle`, `pve`, `scout`, `defense`, `arena`,
`campaign`, `bosslog`, `bossrank` (the keys of `SCREENSHOT_KINDS`).

The battle report against a player has one message per tab, each with its own picture: `battle-1` Overview,
`battle-2` Hero, `battle-3` Lineup, `battle-4` Battle Statistics. A report against a monster has no Overview tab, a
raid on a city without troops no Lineup tab either: `raid.png` shows that.

This repository is public: use screenshots you are fine showing to anyone. Cover the names of other players and all
coordinates (the Location line and the X/Y under each side) before adding a picture. A new or changed picture is
posted on the next start after the deploy.
