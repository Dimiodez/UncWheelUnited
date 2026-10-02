-- A website feed belongs to a specific league, which already belongs to one guild.
ALTER TABLE leagues ADD COLUMN source_url TEXT;

-- All leagues start unlinked. Administrators must select the matching season's
-- website feed explicitly; a Season 1 feed must not appear as Season 2 data.
