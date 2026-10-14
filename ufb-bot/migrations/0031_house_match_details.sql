CREATE TABLE house_club_match_details (
 club_id TEXT NOT NULL,
 match_id TEXT NOT NULL,
 details_json TEXT NOT NULL,
 PRIMARY KEY (club_id,match_id)
);
