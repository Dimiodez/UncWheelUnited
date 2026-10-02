-- Discord supplies guild_id on every server interaction. Persist it on the
-- root records so every child row can be isolated through its parent.
ALTER TABLE leagues ADD COLUMN guild_id TEXT NOT NULL DEFAULT '';
ALTER TABLE cups ADD COLUMN guild_id TEXT NOT NULL DEFAULT '';

CREATE INDEX leagues_by_guild ON leagues(guild_id, archived_at, is_system, name);
CREATE INDEX cups_by_guild ON cups(guild_id, lifecycle, name);

-- EA-player ownership is server-local. The same Discord member may participate
-- in separate communities without one server changing another server's claim.
CREATE TABLE guild_player_claims (
  guild_id TEXT NOT NULL,
  discord_id TEXT NOT NULL REFERENCES members(discord_id) ON DELETE CASCADE,
  ea_player_name TEXT NOT NULL COLLATE NOCASE,
  ea_player_id TEXT,
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, discord_id),
  UNIQUE (guild_id, ea_player_name),
  UNIQUE (guild_id, ea_player_id)
);

-- A member can advertise independently in two Discord servers.
DROP INDEX IF EXISTS one_active_free_agent_post_per_user;
CREATE UNIQUE INDEX one_active_free_agent_post_per_guild_user
ON recruitment_posts(guild_id, author_discord_id)
WHERE kind = 'free_agent' AND active = 1;
