-- Existing events keep their original kickoff deadline and all saved responses.
ALTER TABLE schedule_series ADD COLUMN event_format TEXT NOT NULL DEFAULT 'Match night';
ALTER TABLE schedule_series ADD COLUMN points_win INTEGER NOT NULL DEFAULT 3 CHECK(points_win BETWEEN 0 AND 100);
ALTER TABLE schedule_series ADD COLUMN points_draw INTEGER NOT NULL DEFAULT 1 CHECK(points_draw BETWEEN 0 AND 100);
ALTER TABLE schedule_series ADD COLUMN points_loss INTEGER NOT NULL DEFAULT 0 CHECK(points_loss BETWEEN 0 AND 100);
ALTER TABLE schedule_series ADD COLUMN signup_close_minutes INTEGER NOT NULL DEFAULT 0 CHECK(signup_close_minutes >= 0);

CREATE TABLE schedule_responses_expanded (
 occurrence_id INTEGER NOT NULL REFERENCES schedule_occurrences(id) ON DELETE CASCADE,
 discord_id TEXT NOT NULL,
 display_name TEXT NOT NULL,
 response TEXT NOT NULL CHECK(response IN ('yes','tentative','no','substitute')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(occurrence_id,discord_id)
);
INSERT INTO schedule_responses_expanded SELECT occurrence_id,discord_id,display_name,response,updated_at FROM schedule_responses;
DROP TABLE schedule_responses;
ALTER TABLE schedule_responses_expanded RENAME TO schedule_responses;
