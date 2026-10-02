ALTER TABLE teams ADD COLUMN dissolved_at TEXT;
CREATE INDEX teams_active_by_league ON teams(league_id, dissolved_at);
