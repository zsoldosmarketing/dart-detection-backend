/*
  # Add bot parameters to game_players table

  1. Changes
    - Add `bot_difficulty` column to store bot difficulty level for local games
    - Add `bot_params` column to store bot parameters as JSONB

  2. Purpose
    - Allow different bot difficulties per player in local multiplayer games
    - Each bot player can have its own difficulty settings
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_players' AND column_name = 'bot_difficulty'
  ) THEN
    ALTER TABLE game_players ADD COLUMN bot_difficulty text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_players' AND column_name = 'bot_params'
  ) THEN
    ALTER TABLE game_players ADD COLUMN bot_params jsonb;
  END IF;
END $$;