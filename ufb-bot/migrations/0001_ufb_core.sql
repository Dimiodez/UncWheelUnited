PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  discord_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leagues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  squad_size INTEGER NOT NULL CHECK (squad_size > 0),
  registration_open INTEGER NOT NULL DEFAULT 0 CHECK (registration_open IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE RESTRICT,
  name TEXT NOT NULL COLLATE NOCASE,
  manager_discord_id TEXT NOT NULL REFERENCES members(discord_id) ON DELETE RESTRICT,
  ea_club_id TEXT,
  ea_club_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(league_id, name)
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL REFERENCES members(discord_id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('manager', 'player')),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, discord_id)
);

CREATE TABLE IF NOT EXISTS player_claims (
  discord_id TEXT PRIMARY KEY REFERENCES members(discord_id) ON DELETE CASCADE,
  ea_player_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  ea_player_id TEXT UNIQUE,
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matchnights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by TEXT NOT NULL REFERENCES members(discord_id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matchnight_responses (
  matchnight_id INTEGER NOT NULL REFERENCES matchnights(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL REFERENCES members(discord_id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('yes', 'tentative', 'no')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (matchnight_id, discord_id)
);

CREATE INDEX IF NOT EXISTS teams_by_manager ON teams(manager_discord_id);
CREATE INDEX IF NOT EXISTS teams_by_league ON teams(league_id);
CREATE INDEX IF NOT EXISTS team_members_by_member ON team_members(discord_id);
