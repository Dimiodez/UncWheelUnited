CREATE TABLE IF NOT EXISTS patch_channels (
 guild_id TEXT PRIMARY KEY,
 channel_id TEXT NOT NULL,
 last_checked_at INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patch_deliveries (
 guild_id TEXT NOT NULL,
 card_id TEXT NOT NULL,
 channel_id TEXT NOT NULL,
 message_id TEXT,
 fingerprint TEXT NOT NULL,
 status TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(guild_id,card_id)
);
