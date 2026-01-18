/*
  # Add Comprehensive Match Statistics

  ## New Statistics Added

  1. **leg_statistics Enhancements**
     - `first_9_average` - Átlag az első 9 nyílból
     - `visits_60_plus` - 60+ körök száma
     - `visits_100_plus` - 100+ körök száma
     - `visits_140_plus` - 140+ körök száma
     - `sector_hits` - JSON mező a szektortalálatok tárolásához
     - `min_darts_leg` - Leg minimum nyíl száma

  2. **match_statistics Enhancements**
     - `first_9_average` - Átlag az első 9 nyílból a meccsen
     - `visits_60_plus` - 60+ körök száma a meccsen
     - `visits_100_plus` - 100+ körök száma a meccsen
     - `visits_140_plus` - 140+ körök száma a meccsen
     - `min_darts_leg` - Leg minimum nyíl száma a meccsen
     - `sector_hits` - JSON mező a szektortalálatok tárolásához

  3. **player_statistics_summary Enhancements**
     - `first_9_average` - Lifetime első 9 nyíl átlaga
     - `lifetime_60_plus` - 60+ körök száma lifetime
     - `lifetime_100_plus` - 100+ körök száma lifetime
     - `lifetime_140_plus` - 140+ körök száma lifetime
     - `lifetime_sector_hits` - JSON mező a szektortalálatok tárolásához

  ## Security
  - All existing RLS policies remain in place
*/

-- ============================================================================
-- PART 1: Add New Columns to leg_statistics
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leg_statistics' AND column_name = 'first_9_average'
  ) THEN
    ALTER TABLE leg_statistics ADD COLUMN first_9_average numeric(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leg_statistics' AND column_name = 'visits_60_plus'
  ) THEN
    ALTER TABLE leg_statistics ADD COLUMN visits_60_plus int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leg_statistics' AND column_name = 'visits_100_plus'
  ) THEN
    ALTER TABLE leg_statistics ADD COLUMN visits_100_plus int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leg_statistics' AND column_name = 'visits_140_plus'
  ) THEN
    ALTER TABLE leg_statistics ADD COLUMN visits_140_plus int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leg_statistics' AND column_name = 'sector_hits'
  ) THEN
    ALTER TABLE leg_statistics ADD COLUMN sector_hits jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leg_statistics' AND column_name = 'min_darts_leg'
  ) THEN
    ALTER TABLE leg_statistics ADD COLUMN min_darts_leg int DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- PART 2: Add New Columns to match_statistics
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_statistics' AND column_name = 'first_9_average'
  ) THEN
    ALTER TABLE match_statistics ADD COLUMN first_9_average numeric(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_statistics' AND column_name = 'visits_60_plus'
  ) THEN
    ALTER TABLE match_statistics ADD COLUMN visits_60_plus int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_statistics' AND column_name = 'visits_100_plus'
  ) THEN
    ALTER TABLE match_statistics ADD COLUMN visits_100_plus int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_statistics' AND column_name = 'visits_140_plus'
  ) THEN
    ALTER TABLE match_statistics ADD COLUMN visits_140_plus int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_statistics' AND column_name = 'min_darts_leg'
  ) THEN
    ALTER TABLE match_statistics ADD COLUMN min_darts_leg int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_statistics' AND column_name = 'sector_hits'
  ) THEN
    ALTER TABLE match_statistics ADD COLUMN sector_hits jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- PART 3: Add New Columns to player_statistics_summary
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_statistics_summary' AND column_name = 'lifetime_first_9_average'
  ) THEN
    ALTER TABLE player_statistics_summary ADD COLUMN lifetime_first_9_average numeric(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_statistics_summary' AND column_name = 'lifetime_60_plus'
  ) THEN
    ALTER TABLE player_statistics_summary ADD COLUMN lifetime_60_plus int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_statistics_summary' AND column_name = 'lifetime_100_plus'
  ) THEN
    ALTER TABLE player_statistics_summary ADD COLUMN lifetime_100_plus int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_statistics_summary' AND column_name = 'lifetime_140_plus'
  ) THEN
    ALTER TABLE player_statistics_summary ADD COLUMN lifetime_140_plus int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_statistics_summary' AND column_name = 'lifetime_sector_hits'
  ) THEN
    ALTER TABLE player_statistics_summary ADD COLUMN lifetime_sector_hits jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
