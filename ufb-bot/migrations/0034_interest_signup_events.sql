-- Untimed interest posts stay open until their organizer closes them.
-- Preserve timed events already created with the previous event command.
ALTER TABLE schedule_series ADD COLUMN interest_only INTEGER NOT NULL DEFAULT 0 CHECK(interest_only IN (0,1));
