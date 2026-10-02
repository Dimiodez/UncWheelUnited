-- Guild-scoped event attendance; separate from official league fixtures.
CREATE TABLE IF NOT EXISTS schedule_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  recurrence TEXT NOT NULL CHECK (recurrence IN ('none','daily','weekly','biweekly')),
  total_occurrences INTEGER NOT NULL DEFAULT 1 CHECK (total_occurrences BETWEEN 1 AND 52),
  created_count INTEGER NOT NULL DEFAULT 1,
  next_local TEXT,
  next_post_at INTEGER,
  lease_until INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedule_occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id INTEGER NOT NULL REFERENCES schedule_series(id) ON DELETE CASCADE,
  starts_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','cancelled')),
  message_id TEXT,
  UNIQUE(series_id, starts_at)
);

CREATE TABLE IF NOT EXISTS schedule_responses (
  occurrence_id INTEGER NOT NULL REFERENCES schedule_occurrences(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  response TEXT NOT NULL CHECK (response IN ('yes','tentative','no')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (occurrence_id, discord_id)
);

CREATE INDEX IF NOT EXISTS schedule_series_due ON schedule_series(active,next_post_at,lease_until);
CREATE INDEX IF NOT EXISTS schedule_series_guild ON schedule_series(guild_id,creator_id);
