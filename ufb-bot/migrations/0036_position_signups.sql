CREATE TABLE position_signup_boards (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guild_id TEXT NOT NULL,
 channel_id TEXT NOT NULL,
 creator_id TEXT NOT NULL,
 title TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 closed_at TEXT
);

CREATE TABLE position_signup_selections (
 board_id INTEGER NOT NULL REFERENCES position_signup_boards(id) ON DELETE CASCADE,
 discord_id TEXT NOT NULL,
 display_name TEXT NOT NULL,
 position TEXT NOT NULL CHECK(position IN ('GK','LB','CB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(board_id,discord_id,position)
);

CREATE INDEX position_signup_boards_by_guild ON position_signup_boards(guild_id,active,created_at);
CREATE INDEX position_signup_selections_by_player ON position_signup_selections(discord_id,board_id);