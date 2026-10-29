ALTER TABLE position_signup_selections ADD COLUMN signup_order INTEGER NOT NULL DEFAULT 0;

UPDATE position_signup_selections
SET signup_order=(
 SELECT COUNT(*)
 FROM position_signup_selections AS earlier
 WHERE earlier.board_id=position_signup_selections.board_id
   AND earlier.position=position_signup_selections.position
   AND (
    earlier.updated_at<position_signup_selections.updated_at
    OR (earlier.updated_at=position_signup_selections.updated_at AND earlier.rowid<=position_signup_selections.rowid)
   )
);

CREATE INDEX position_signup_selections_by_order
 ON position_signup_selections(board_id,position,signup_order);
