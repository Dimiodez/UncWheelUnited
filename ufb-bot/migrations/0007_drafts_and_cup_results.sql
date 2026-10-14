CREATE TABLE drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES members(discord_id),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','drafting','complete')),
  pick_mode TEXT NOT NULL DEFAULT 'snake' CHECK(pick_mode IN ('snake','round_robin')),
  rules TEXT NOT NULL DEFAULT 'Captains pick in order. Each player can join one side only.',
  next_pick INTEGER NOT NULL DEFAULT 0,
  UNIQUE(guild_id,name)
);
CREATE TABLE draft_sides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  captain_discord_id TEXT NOT NULL REFERENCES members(discord_id),
  UNIQUE(draft_id,name), UNIQUE(draft_id,captain_discord_id)
);
CREATE TABLE draft_players (
  draft_id INTEGER NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL REFERENCES members(discord_id),
  side_id INTEGER REFERENCES draft_sides(id),
  pick_number INTEGER,
  PRIMARY KEY(draft_id,discord_id), UNIQUE(draft_id,pick_number)
);
ALTER TABLE cups ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'registration';
ALTER TABLE cup_matches ADD COLUMN home_score INTEGER;
ALTER TABLE cup_matches ADD COLUMN away_score INTEGER;
ALTER TABLE cup_matches ADD COLUMN result_state TEXT;
ALTER TABLE cup_matches ADD COLUMN submitted_by TEXT;
ALTER TABLE cup_matches ADD COLUMN winner_entry_id INTEGER REFERENCES cup_entries(id);
UPDATE cups SET competition_mode='draw' WHERE format='draw' AND competition_mode='knockout';
UPDATE cups SET lifecycle=CASE WHEN competition_mode IN ('league','league_knockout') THEN 'league' ELSE 'knockout' END WHERE registration_open=0;
UPDATE cup_matches SET result_state='confirmed',winner_entry_id=COALESCE(home_entry_id,away_entry_id) WHERE status='bye' AND (home_entry_id IS NOT NULL OR away_entry_id IS NOT NULL);
