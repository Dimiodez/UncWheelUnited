-- Preserve existing rosters; reject new cross-team membership in a league.
CREATE TRIGGER roster_one_team_per_league_insert
BEFORE INSERT ON team_members
WHEN EXISTS (
 SELECT 1 FROM team_members m JOIN teams existing ON existing.id=m.team_id
 JOIN teams target ON target.id=NEW.team_id
 WHERE m.discord_id=NEW.discord_id AND existing.league_id=target.league_id AND m.team_id<>NEW.team_id
)
BEGIN SELECT RAISE(ABORT, 'ROSTER_LEAGUE_CONFLICT'); END;
CREATE TRIGGER roster_one_team_per_league_update
BEFORE UPDATE OF team_id,discord_id ON team_members
WHEN EXISTS (
 SELECT 1 FROM team_members m JOIN teams existing ON existing.id=m.team_id
 JOIN teams target ON target.id=NEW.team_id
 WHERE m.discord_id=NEW.discord_id AND existing.league_id=target.league_id
 AND m.team_id<>NEW.team_id AND NOT(m.team_id=OLD.team_id AND m.discord_id=OLD.discord_id)
)
BEGIN SELECT RAISE(ABORT, 'ROSTER_LEAGUE_CONFLICT'); END;
ALTER TABLE recruitment_posts ADD COLUMN expires_at INTEGER;
UPDATE recruitment_posts SET expires_at=unixepoch('now')+604800 WHERE kind='free_agent';
CREATE INDEX recruitment_expiry ON recruitment_posts(kind,active,expires_at);
CREATE TABLE cup_organizers (
 cup_id INTEGER NOT NULL REFERENCES cups(id) ON DELETE CASCADE,
 discord_id TEXT NOT NULL,
 PRIMARY KEY(cup_id,discord_id)
);
CREATE TABLE server_settings (
 guild_id TEXT PRIMARY KEY,
 manager_role_id TEXT,
 default_league TEXT,
 default_cup TEXT
);
CREATE TRIGGER roster_league_move_guard BEFORE UPDATE OF league_id ON teams
WHEN EXISTS (SELECT 1 FROM team_members a JOIN team_members b ON a.discord_id=b.discord_id
 JOIN teams t ON t.id=b.team_id WHERE a.team_id=OLD.id AND b.team_id<>OLD.id AND t.league_id=NEW.league_id)
BEGIN SELECT RAISE(ABORT, 'ROSTER_LEAGUE_CONFLICT'); END;
CREATE TRIGGER cup_entry_insert_guard BEFORE INSERT ON cup_entries
WHEN EXISTS(SELECT 1 FROM cups WHERE id=NEW.cup_id AND registration_open=0)
 OR EXISTS(SELECT 1 FROM cup_matches WHERE cup_id=NEW.cup_id)
BEGIN SELECT RAISE(ABORT, 'CUP_REGISTRATION_LOCKED'); END;
CREATE TRIGGER cup_entry_delete_guard BEFORE DELETE ON cup_entries
WHEN EXISTS(SELECT 1 FROM cup_matches WHERE cup_id=OLD.cup_id)
BEGIN SELECT RAISE(ABORT, 'CUP_ENTRANTS_LOCKED'); END;
CREATE TRIGGER cup_reopen_guard BEFORE UPDATE OF registration_open ON cups
WHEN NEW.registration_open=1 AND (OLD.lifecycle='cancelled' OR EXISTS(SELECT 1 FROM cup_matches WHERE cup_id=OLD.id))
BEGIN SELECT RAISE(ABORT, 'CUP_REGISTRATION_LOCKED'); END;
