/*
  # Add Preferred Doubles to Player Profiles

  1. Changes
    - Add `preferred_doubles` column to `player_profiles` table
      - Type: integer array
      - Default: [20, 16, 8] (most common preferred doubles)
    
  2. Notes
    - This allows players to customize which doubles they prefer for checkout suggestions
    - The checkout engine will prioritize these doubles when suggesting routes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_profiles' AND column_name = 'preferred_doubles'
  ) THEN
    ALTER TABLE player_profiles 
    ADD COLUMN preferred_doubles integer[] DEFAULT ARRAY[20, 16, 8];
  END IF;
END $$;