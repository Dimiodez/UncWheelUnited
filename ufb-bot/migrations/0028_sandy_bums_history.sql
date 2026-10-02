CREATE TABLE IF NOT EXISTS house_club_sync (
  club_id TEXT PRIMARY KEY,
  last_attempt_at INTEGER,
  last_success_at INTEGER,
  lease_until INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS house_club_matches (
  club_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  played_at INTEGER NOT NULL,
  local_month TEXT NOT NULL,
  opponent_name TEXT NOT NULL,
  goals_for INTEGER NOT NULL,
  goals_against INTEGER NOT NULL,
  PRIMARY KEY (club_id, match_id)
);
CREATE INDEX IF NOT EXISTS house_club_matches_by_month ON house_club_matches(club_id, local_month, played_at DESC);

CREATE TABLE IF NOT EXISTS house_club_players (
  club_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  latest_name TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (club_id, player_id)
);

CREATE TABLE IF NOT EXISTS house_club_appearances (
  club_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  goals INTEGER NOT NULL,
  assists INTEGER NOT NULL,
  rating REAL,
  PRIMARY KEY (club_id, match_id, player_id),
  FOREIGN KEY (club_id, match_id) REFERENCES house_club_matches(club_id, match_id),
  FOREIGN KEY (club_id, player_id) REFERENCES house_club_players(club_id, player_id)
);
CREATE INDEX IF NOT EXISTS house_club_appearances_by_player ON house_club_appearances(club_id, player_id);

INSERT OR IGNORE INTO house_club_sync (club_id) VALUES ('43521');
