CREATE TABLE team_managers (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL REFERENCES members(discord_id) ON DELETE RESTRICT,
  PRIMARY KEY (team_id, discord_id)
);
CREATE INDEX team_managers_by_discord ON team_managers(discord_id, team_id);
INSERT OR IGNORE INTO team_managers(team_id, discord_id)
SELECT id, manager_discord_id FROM teams;
