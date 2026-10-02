ALTER TABLE teams ADD COLUMN ea_crest_url TEXT;

CREATE TABLE command_cooldowns (
  guild_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  command_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, actor_id, command_key)
);

CREATE INDEX command_cooldowns_by_expiry ON command_cooldowns(expires_at);
