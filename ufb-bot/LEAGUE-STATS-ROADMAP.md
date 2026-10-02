# Future /leaguestats

Keep the existing command unchanged until category leaderboards are added to the UFL website feed. Do not implement direct VirtualArena stat reads in the bot.

Then replace team totals with top-five player category cards based on https://ufl.virtualarena.app/competitions/1/seasons/1/stats and the user's screenshots:

- Goals
- Assists
- Goals + assists
- Tackles per game
- Goalkeeper clean sheets
- Defender clean sheets
- Average match rating

Each category should show rank, player, club, value and available profile/club imagery. Use the website as the common source and retain source-update metadata. No values, OVR or player tiers.
