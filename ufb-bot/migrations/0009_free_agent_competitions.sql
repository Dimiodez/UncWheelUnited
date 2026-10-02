ALTER TABLE recruitment_posts ADD COLUMN competitions TEXT NOT NULL DEFAULT '["all"]';
ALTER TABLE recruitment_posts ADD COLUMN awaiting_competitions INTEGER NOT NULL DEFAULT 0;
