CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  opponent_name TEXT NOT NULL,
  team_score INTEGER NOT NULL CHECK (team_score >= 0),
  opponent_score INTEGER NOT NULL CHECK (opponent_score >= 0),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ea')),
  played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reported_by TEXT NOT NULL REFERENCES members(discord_id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS match_player_stats (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL REFERENCES members(discord_id) ON DELETE RESTRICT,
  goals INTEGER NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists INTEGER NOT NULL DEFAULT 0 CHECK (assists >= 0),
  rating REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  PRIMARY KEY (match_id, discord_id)
);

CREATE INDEX IF NOT EXISTS matches_by_team_played_at ON matches(team_id, played_at DESC);
CREATE INDEX IF NOT EXISTS match_player_stats_by_member ON match_player_stats(discord_id);
