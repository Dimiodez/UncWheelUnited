# Match image monitoring

`/gamestats team_a:<selection> team_b:<selection>` searches the recent FC27 feed history first and queues two PNG posts for one matching game. If there is no prior head-to-head in the feed, it checks for an EA reporting delay for 5–60 minutes (`timeout`, default 15). If multiple prior games are available, `match_id` selects the intended result without guessing. `background` selects one of six supplied images. Manager-role members can set `demo:true` to render fictional data without linking clubs or changing match/player results.

`/automode start team:<selection>` watches one linked club and posts each new game's human-player sheet. `idle_minutes` is 15–240 (default 60). `/automode stop team:<selection>` stops it in that channel; `/automode status` lists active watchers. No session recap yet. Starting/stopping requires the selected team's manager or Manager role.

Cron checks run once a minute. Durable D1 leases and per-channel/match/team delivery reservations prevent overlapping runs and duplicate posts. A network-ambiguous delivery is not blindly resent. These image posts do not submit or confirm official competition results.

## Live feed gate

FC27 club search uses EA's `allTimeLeaderboard/search` route. Because EA's edge blocks Cloudflare Worker egress, production reads the same FC27 data through the HTTPS relay configured by `EA_API_BASE_URL`. Set `EA_MATCHES_ENABLED=true` only when `/setup checkfeed` passes for a linked club. `EA_MATCH_FEED_URL` remains supported for a fully normalized private feed. A normalized feed receives `clubId` and `platform` query parameters and returns an array of:

```json
{"id":"unique-match-id","playedAt":1790000000000,"clubs":[{"id":"club-a","name":"Team A","score":1,"players":[{"id":"ea-player-id","name":"Human player","human":true,"stats":["CAM","8.0","1","2","0","0","1","5","3 / 2","24 / 30 (80%)","2 / 4 (50%)","2","1","—"]}]},{"id":"club-b","name":"Team B","score":0,"players":[]}]}
```

`playedAt` is epoch milliseconds. `human` must be explicit and verified against the source, not inferred from Discord membership, /claim or a roster. The 14 ordered strings are position, rating, goals, shots, assists, secondary assists, key passes, dribbles, possession won/lost, passes, tackles, interceptions, blocks, saves. The current FC27 relay supplies interceptions, so those are displayed; secondary assists, key passes, dribbles, possession won/lost and blocks remain visibly unavailable instead of being fabricated. Images support 1–11 humans per team and preserve the approved overlay. Game requests consider matches from ten minutes before the command onward; automatic requests only consider new session matches.

Browser Rendering (`BROWSER`) renders PNGs; `ASSETS` supplies the six backgrounds. Runtime dependencies are isolated in `runtime/` because the legacy node_modules directory is a junction. Install with pnpm `--ignore-workspace --dir ufb-bot/runtime install --ignore-scripts`. Deploy migrations before the Worker and re-register Discord commands afterward. No Discord OAuth callback change is required.
