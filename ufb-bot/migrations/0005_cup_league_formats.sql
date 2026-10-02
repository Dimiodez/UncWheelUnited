ALTER TABLE cups ADD COLUMN competition_mode TEXT NOT NULL DEFAULT 'knockout' CHECK (competition_mode IN ('knockout', 'draw', 'league', 'league_knockout'));
ALTER TABLE cups ADD COLUMN playoff_size INTEGER;
ALTER TABLE cup_matches ADD COLUMN stage TEXT NOT NULL DEFAULT 'knockout' CHECK (stage IN ('league', 'knockout'));
