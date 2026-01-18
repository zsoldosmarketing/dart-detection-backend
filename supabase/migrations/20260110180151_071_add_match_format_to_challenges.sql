/*
  # Add Match Format to PVP Challenges

  1. Changes
    - Add `match_format` column to pvp_challenges table
    - Default to 'first_to' to match typical game defaults
    - Update pvp_lobby table to also include match_format

  2. Notes
    - match_format can be 'first_to' or 'best_of'
    - This determines how legs_to_win and sets_to_win are interpreted
    - 'first_to' = first to reach X legs/sets wins
    - 'best_of' = best of X legs/sets (e.g. best of 3 = first to 2)
*/

-- Add match_format to pvp_challenges
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pvp_challenges' AND column_name = 'match_format'
  ) THEN
    ALTER TABLE pvp_challenges
    ADD COLUMN match_format text NOT NULL DEFAULT 'first_to'
    CHECK (match_format IN ('first_to', 'best_of'));
  END IF;
END $$;

-- Add match_format to pvp_lobby
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pvp_lobby' AND column_name = 'match_format'
  ) THEN
    ALTER TABLE pvp_lobby
    ADD COLUMN match_format text NOT NULL DEFAULT 'first_to'
    CHECK (match_format IN ('first_to', 'best_of'));
  END IF;
END $$;

-- Add match_format to game_rooms for tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_rooms' AND column_name = 'match_format'
  ) THEN
    ALTER TABLE game_rooms
    ADD COLUMN match_format text DEFAULT 'first_to'
    CHECK (match_format IN ('first_to', 'best_of'));
  END IF;
END $$;