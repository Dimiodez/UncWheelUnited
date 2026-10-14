ALTER TABLE recruitment_posts ADD COLUMN guild_id TEXT;
CREATE TABLE free_agent_channels (
 guild_id TEXT NOT NULL,
 competition TEXT NOT NULL,
 channel_id TEXT NOT NULL,
 PRIMARY KEY(guild_id,competition)
);
CREATE TABLE free_agent_deliveries (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id INTEGER NOT NULL REFERENCES recruitment_posts(id),
 guild_id TEXT NOT NULL,
 channel_id TEXT NOT NULL,
 payload TEXT NOT NULL,
 nonce TEXT NOT NULL,
 message_id TEXT,
 status TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0,
 last_error TEXT,
 UNIQUE(post_id,channel_id)
);
CREATE INDEX free_agent_delivery_pending ON free_agent_deliveries(status,next_attempt);
