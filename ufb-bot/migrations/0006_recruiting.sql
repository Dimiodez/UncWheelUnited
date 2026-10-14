CREATE TABLE IF NOT EXISTS recruitment_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('club', 'free_agent')),
  author_discord_id TEXT NOT NULL REFERENCES members(discord_id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  needed_positions TEXT,
  primary_positions TEXT,
  backup_positions TEXT,
  avoid_positions TEXT,
  contact TEXT NOT NULL,
  pitch TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_club_post_per_team ON recruitment_posts(team_id) WHERE kind = 'club' AND active = 1;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_free_agent_post_per_user ON recruitment_posts(author_discord_id) WHERE kind = 'free_agent' AND active = 1;
