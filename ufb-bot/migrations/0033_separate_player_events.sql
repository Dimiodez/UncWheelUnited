-- Preserve existing team RSVP events; player event posts are a separate workflow.
ALTER TABLE schedule_series ADD COLUMN event_kind TEXT NOT NULL DEFAULT 'rsvp' CHECK(event_kind IN ('rsvp','event'));
