# White Elephant Captain Draft

Optional rule set in Captain Draft; default remains normal snake drafting. Before picking the order, enable White Elephant, choose one or two total steals per player and assign captains. Available-player and other-team roster drops both call the same atomic move engine. A steal immediately gives the losing captain a replacement turn, holding the normal order until a pool player is drafted. Replacement steals pass the replacement turn to the newly displaced captain, subject to the same steal limits. Replacement picks do not consume regular turns. The pending replacement team is saved with the session, and reset clears it. When no replacement is possible, normal eligible turns continue. Full teams are skipped. Snake endpoints may legitimately pick twice in succession.

Captains cannot be stolen. After the selected number of steals, a player is locked for the rest of that draft. Invalid/out-of-turn/full-team drops do not consume turns. Locked roster members cannot be dragged. Returning players to the pool and changing captains/rules are blocked during an active White Elephant draft; use the explicit confirmed reset to start over. The draft ends once no legal picks remain, including when all teams are full.

Draft state is part of Session.drafts, including order, turn, selected captains, steal counts and settings. Existing browser session saves, JSON exports, and event snapshots therefore retain it. Captain and fantasy draft state are separate. Normal roster transfers retain their prior behavior and do not consume a draft turn.

Holiday styling defaults on when White Elephant is enabled, with an independent optional switch. Navy/red, icy blue, gold, snowflake and Hanukkah accents are scoped to this draft; other tools and the rest of the website are unchanged. Draft/Steal buttons offer a touch-friendly alternative to dragging.

The strengthened holiday treatment adds thin snow caps to the hero, settings, team setup, draft order, captain pool, roster section bars and team headings. A noninteractive SVG header decoration includes hanging ornaments, a gift and a nine-candle Hanukkiah. Decorations never intercept drags/clicks and disappear when holiday mode is off.

Captain Draft includes a direct Add Team form with a name and 1–12 player roster size. Names are trimmed and duplicates rejected. Team creation is blocked once the draft order exists so a running draft cannot silently gain another team. This uses the existing session/team model and persistence; no separate league registrations are created.

Build with the existing Vite toolchain. Public UNC wheel deployment copies only the generated main JS/CSS into wheel-app/wheel.js and wheel-app/wheel.css, retaining the live theme bridge, other assets and Aggregate BYOT integration. No bot, league workshop, roster database or website-account permissions change.
