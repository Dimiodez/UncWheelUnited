ALTER TABLE schedule_series ADD COLUMN reminder_policy TEXT NOT NULL DEFAULT 'none';
ALTER TABLE schedule_series ADD COLUMN thread_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE schedule_occurrences ADD COLUMN creation_interaction_id TEXT;
ALTER TABLE schedule_occurrences ADD COLUMN thread_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS schedule_occurrence_interaction ON schedule_occurrences(creation_interaction_id) WHERE creation_interaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS schedule_reminders (
  occurrence_id INTEGER NOT NULL REFERENCES schedule_occurrences(id) ON DELETE CASCADE,
  offset_minutes INTEGER NOT NULL CHECK (offset_minutes IN (60,1440)),
  sent_at INTEGER,
  lease_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(occurrence_id,offset_minutes)
);
CREATE INDEX IF NOT EXISTS schedule_reminders_due ON schedule_reminders(sent_at,lease_until);
