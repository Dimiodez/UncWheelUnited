# FC27 public API: AMPs, consumables, PlayStyles and attribute sources

Audit date: 2026-10-02. Expanded live run started at 21:31:26 UTC.
Platform: `common-gen5`. This was read-only: no Worker deployment, Discord
messages, database changes or website changes were performed.

## Finding

No verified public endpoint or decoded field was found that identifies a
player's equipped AMPs, active progression consumables, equipped PlayStyles,
club facilities, mastery unlocks, or the sources of individual attribute
bonuses. Do not build an AMP enforcement rule from the current evidence.

This is a statement about the public endpoints inspected and the live sample,
not a claim that EA's private in-game services lack this information.

## Live checks

- 40 direct EA GET requests: 35 HTTP 200, three HTTP 500, two HTTP 404.
- Three additional successful GET requests to our existing relay.
- 30 distinct league matches, 301 human player-match rows, 146 distinct
  player identifiers. The player rows include both teams in each match.
- Current member records: Sandy Bums 33, Mountains 20. These are roster
  entries, not necessarily 53 distinct people.
- Odez appeared in 16 sampled player-match rows across the three clubs.

| Public route under `https://proclubs.ea.com/api/fc/` | Scope |
| --- | --- |
| `clubs/info` | Three known club IDs |
| `clubs/overallStats` | Three known club IDs |
| `members/stats` | Three known club IDs |
| `members/career/stats` | Three known club IDs |
| `clubs/matches` | League, playoff and friendly types for all three; additional playoff/friendly probes for three source-derived or leaderboard-derived IDs |
| `club/playoffAchievements` | Three known club IDs |
| `allTimeLeaderboard/search` | Each known club name |
| `currentSeasonLeaderboard/search` | Each known club name |
| `allTimeLeaderboard` | Full returned 100-row leaderboard schema |
| `currentSeasonLeaderboard` | Full returned 100-row leaderboard schema |
| Legacy `members/{id}/stats` and `clubs/{clubId}/members/{id}/stats` | One Odez match personaId; both HTTP 404 |

The legacy routes were present in older SDK code. A modern match personaId
is not established to be the legacy blazeId; the failed requests do not prove
that every authenticated or legacy player-specific service is unavailable.

Clubs tested: FC Sandy Bums `43521`, FC Mountains `96510`, and the known
UFL Gladbach match-history ID `64234`. Gladbach's club-info/current-member/
career-member requests returned HTTP 500, while its match history returned
ten games. Search returned no Gladbach record. These failures were not
converted into successful empty rosters.

All sampled friendly and playoff requests returned empty arrays. Therefore
there is no populated friendly/playoff player schema in this audit; absence
of fields in empty arrays is not evidence of absence in those match types.

## Build-related fields actually observed

| Field | Observed data | Interpretation allowed |
| --- | --- | --- |
| `archetypeid` | Individual player values in the 1-13 range | An archetype identifier, not AMP equipment or all archetype levels |
| `proOverall`, `proOverallStr` | Current member overall ratings | EA's returned overall, with no breakdown of bonuses or guarantee of match-time state |
| `proHeight`, `proPos` | Current member height/position values | Limited profile metadata, not complete body settings or attribute allocation |
| `proStyle` | `0` on 49 member entries; empty on four | Not a verified list of equipped PlayStyles; do not infer "no PlayStyles" from `0` |
| `vproattr` | `NH` on 278 player-match rows; empty on 23 | No detailed attribute vector in this sample; `NH` is not a verified AMP/compliance flag |
| `vprohackreason` | `0` on all 301 player-match rows | No verified AMP or PlayStyle meaning; must not certify "no AMPs" |
| `match_event_aggregate_0..3` | Comma-separated numeric event counters | Undocumented match telemetry; no validated equipped-AMP or PlayStyle decoder found |
| `reputationlevel` | Present on club leaderboards | Club reputation, not the player's archetype level/mastery progression |

Older code splits `vproattr` on `|` to extract detailed attributes. That
format is not present in any of the 301 actual player-match rows audited.
Some aggregate records contain `vproattr: 0` and summed `archetypeid` values;
those are team aggregates and must not be treated as player loadouts.

The current relay also exposes no AMP/PlayStyle/facility data and omits some
of the raw build-related fields. Direct EA checks prevent that normalization
from being mistaken for EA's underlying capability.

## What cannot be reliably derived

- All equipped PlayStyles, including facility-granted or AMP-granted ones.
- Which facility was selected or what it contributed in a past match.
- Pace, finishing or other individual attributes with body-type effects,
  facilities, mastery bonuses and AMPs separately identified.
- A player's unlocked mastery milestones or levels on other builds.
- Active AXP consumables, consumable inventory, remaining uses or use history.

Even if a final attribute total were available, it would not uniquely identify
its source without the build allocation and modifiers. EA also documents
attribute caps that can truncate AMP bonuses. Rating changes or performance
differences alone cannot prove prohibited AMP use.

EA's launch notes specifically say AMPs do not provide PlayStyle+ at launch.
Standard AMPs can be attribute-only, so inspecting PlayStyles alone would
not be sufficient to enforce an all-AMP ban even if a list became available.

## Sources inspected

- [EA Grounds & Clubs Deep Dive: Masteries, AMPs and consumables](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-the-grounds-deep-dive)
- [EA AMP help: slots, benefits, durability and attribute caps](https://help.ea.com/en/articles/ea-sports-fc/amps/)
- [EA launch update: AMP behavior at launch](https://www.ea.com/games/ea-sports-fc/fc-27/news/pitch-notes-fc27-launch-update)
- [EA Archetypes help](https://help.ea.com/en/articles/ea-sports-fc/archetypes/)
- [EA account Community API help](https://help.ea.com/en/articles/ea-sports-fc/community-api/): approved partner account connections, not a published Clubs loadout schema
- [FC27 public endpoint observations](https://github.com/1erkandogan/fc27-clubs-api/blob/800129926093589fe3ac4716731f11e166c7f2e3/docs/endpoints.md)
- [Current SDK route inventory](https://github.com/alex-jordan547/proclubs-sdk/blob/c6d7c154c107fe62c0f0ea7b33b8f30d1bcb9da9/src/constants.ts)
- [Current SDK member schema](https://github.com/alex-jordan547/proclubs-sdk/blob/c6d7c154c107fe62c0f0ea7b33b8f30d1bcb9da9/docs/reference/members.mdx)
- [Another Clubs service's EA routes](https://github.com/eltrueno/TruenoProClubServices/blob/8da8dbb19405ef21d7da9325860ad351236ed43b/packages/eafcapi/src/core/club.ts)
- [Legacy per-player routes and blazeId limitation](https://github.com/eltrueno/TruenoProClubServices/blob/8da8dbb19405ef21d7da9325860ad351236ed43b/packages/eafcapi/src/core/member.ts)
- [Older pipe-separated attribute decoder](https://github.com/pedrochitarra/clubedorobson-py/blob/5c1ef3ebe83493ef1210d23dcda85ffefb658775/src/utils/player_info.py)
- [A bot's build extractor](https://github.com/Maldini80/bot-torneos-pro/blob/72f71a64fdd58a8e0c6bc5992992a45bc0fb323d/src/utils/eaStatsCrawler.js): stores raw event counters under a local `perks` object; this is not a verified list of equipped perks
- [Original research on match-event counters](https://www.reddit.com/r/fifaclubs/comments/1ws2mv0/pro_clubs_api_decoding_match_event_aggregate/): performance-event mappings, not a validated AMP/loadout mapping

Public code and web searches found older attribute readers and build planners,
but no verified current public equipped-AMP/facility/PlayStyle implementation.
Not every endpoint or private third-party integration can be exhaustively
ruled out by a public audit.

## Remaining useful validation

The audit has no independently confirmed AMP-on/AMP-off pair. The targeted
next test is the same player, same archetype, body settings, attribute
allocation, facilities and mastery state, in two matches: one with a known
AMP active and one without. Compare complete raw player rows and match-event
counters, then repeat any proposed mapping before treating it as evidence.

A named bot that actually reports equipped items for a real player would
also be useful evidence to trace. A configurable build planner or an event
counter labelled `perks` is not equivalent to reading the real loadout.

## Repeat the read-only probe

From the bot directory with a modern Node runtime:

```powershell
node scripts/audit-fc27-consumables.mjs --extended
```

The checker prints schema keys, candidate-value counts, HTTP status and a
deduplicated player-row summary. Raw response bodies and player IDs are not
saved to disk; stdout includes public names and the legacy test request path.
No secrets or login are required. The keyword scan is only a discovery aid;
all reported keys still require semantic verification.
