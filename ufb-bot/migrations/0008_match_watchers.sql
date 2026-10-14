CREATE TABLE match_watchers(id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,channel_id TEXT NOT NULL,created_by TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('game','auto','demo')),team_a INTEGER NOT NULL REFERENCES teams(id),team_b INTEGER REFERENCES teams(id),started_at INTEGER NOT NULL,deadline INTEGER NOT NULL,last_match_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',lease_until INTEGER NOT NULL DEFAULT 0,last_error TEXT,background TEXT NOT NULL DEFAULT 'beach-sunset');
CREATE INDEX active_match_watchers ON match_watchers(status,deadline);
CREATE UNIQUE INDEX single_auto_channel_team ON match_watchers(guild_id,channel_id,team_a) WHERE kind='auto' AND status='pending';
CREATE TABLE stat_deliveries(guild_id TEXT NOT NULL,channel_id TEXT NOT NULL,match_id TEXT NOT NULL,team_id INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'sending',message_id TEXT,PRIMARY KEY(guild_id,channel_id,match_id,team_id));
ALTER TABLE match_watchers ADD COLUMN selected_match TEXT;
ALTER TABLE match_watchers ADD COLUMN idle_ms INTEGER NOT NULL DEFAULT 3600000;
