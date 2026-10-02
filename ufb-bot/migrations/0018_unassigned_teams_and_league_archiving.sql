ALTER TABLE leagues ADD COLUMN archived_at TEXT;
ALTER TABLE leagues ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1));
ALTER TABLE teams ADD COLUMN unassigned INTEGER NOT NULL DEFAULT 0 CHECK (unassigned IN (0,1));
CREATE INDEX leagues_active_visible ON leagues(is_system,archived_at,name);
CREATE INDEX teams_assignment_state ON teams(unassigned,league_id,dissolved_at);

DROP TRIGGER roster_one_team_per_league_insert;
DROP TRIGGER roster_one_team_per_league_update;
DROP TRIGGER roster_league_move_guard;

CREATE TRIGGER roster_one_team_per_league_insert
BEFORE INSERT ON team_members
WHEN (SELECT unassigned FROM teams WHERE id=NEW.team_id)=0
 AND EXISTS (
 SELECT 1 FROM team_members m JOIN teams existing ON existing.id=m.team_id
 JOIN teams target ON target.id=NEW.team_id
 WHERE m.discord_id=NEW.discord_id AND existing.unassigned=0 AND existing.league_id=target.league_id AND m.team_id<>NEW.team_id
)
BEGIN SELECT RAISE(ABORT, 'ROSTER_LEAGUE_CONFLICT'); END;

CREATE TRIGGER roster_one_team_per_league_update
BEFORE UPDATE OF team_id,discord_id ON team_members
WHEN (SELECT unassigned FROM teams WHERE id=NEW.team_id)=0
 AND EXISTS (
 SELECT 1 FROM team_members m JOIN teams existing ON existing.id=m.team_id
 JOIN teams target ON target.id=NEW.team_id
 WHERE m.discord_id=NEW.discord_id AND existing.unassigned=0 AND existing.league_id=target.league_id
 AND m.team_id<>NEW.team_id AND NOT(m.team_id=OLD.team_id AND m.discord_id=OLD.discord_id)
)
BEGIN SELECT RAISE(ABORT, 'ROSTER_LEAGUE_CONFLICT'); END;

CREATE TRIGGER roster_league_move_guard BEFORE UPDATE OF league_id,unassigned ON teams
WHEN NEW.unassigned=0
 AND EXISTS (SELECT 1 FROM team_members a JOIN team_members b ON a.discord_id=b.discord_id
 JOIN teams t ON t.id=b.team_id WHERE a.team_id=OLD.id AND b.team_id<>OLD.id AND t.unassigned=0 AND t.league_id=NEW.league_id)
BEGIN SELECT RAISE(ABORT, 'ROSTER_LEAGUE_CONFLICT'); END;
