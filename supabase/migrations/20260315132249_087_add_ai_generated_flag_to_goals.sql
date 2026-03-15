/*
  # Add ai_generated flag to ai_goals table

  ## Changes
  - Adds `ai_generated` boolean column to `ai_goals` table
    - Tracks whether a goal was automatically created by the AI based on chat conversations
    - Defaults to false for manually created goals
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_goals' AND column_name = 'ai_generated'
  ) THEN
    ALTER TABLE ai_goals ADD COLUMN ai_generated boolean DEFAULT false;
  END IF;
END $$;
