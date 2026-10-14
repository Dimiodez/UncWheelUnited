ALTER TABLE recruitment_posts ADD COLUMN excluded_competitions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE recruitment_posts ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE free_agent_deliveries ADD COLUMN post_revision INTEGER NOT NULL DEFAULT 0;
