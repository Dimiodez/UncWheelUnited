CREATE TABLE IF NOT EXISTS cups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('team', 'byot')),
  format TEXT NOT NULL CHECK (format IN ('knockout', 'draw')),
  registration_open INTEGER NOT NULL DEFAULT 1 CHECK (registration_open IN (0, 1)),
  created_by TEXT NOT NULL REFERENCES members(discord_id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cup_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cup_id INTEGER NOT NULL REFERENCES cups(id) ON DELETE CASCADE,
  entry_name TEXT NOT NULL,
  manager_discord_id TEXT NOT NULL REFERENCES members(discord_id) ON DELETE RESTRICT,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cup_id, entry_name),
  UNIQUE(cup_id, manager_discord_id)
);

CREATE TABLE IF NOT EXISTS cup_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cup_id INTEGER NOT NULL REFERENCES cups(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  home_entry_id INTEGER REFERENCES cup_entries(id) ON DELETE SET NULL,
  away_entry_id INTEGER REFERENCES cup_entries(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'bye')),
  UNIQUE(cup_id, round_number, match_number)
);

CREATE INDEX IF NOT EXISTS cup_entries_by_cup ON cup_entries(cup_id);
CREATE INDEX IF NOT EXISTS cup_matches_by_cup_round ON cup_matches(cup_id, round_number, match_number);
