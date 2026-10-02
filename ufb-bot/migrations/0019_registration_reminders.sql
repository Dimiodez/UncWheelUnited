CREATE TABLE league_registration_schedules (
  league_id INTEGER PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  closes_at INTEGER NOT NULL,
  reminder_interval_days INTEGER NOT NULL CHECK (reminder_interval_days BETWEEN 1 AND 3),
  next_reminder_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  lease_until INTEGER NOT NULL DEFAULT 0,
  closed_at INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX league_registration_schedules_due
ON league_registration_schedules(lease_until, closes_at, next_reminder_at);
