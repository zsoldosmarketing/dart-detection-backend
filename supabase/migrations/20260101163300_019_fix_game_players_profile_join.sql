/*
  # Fix game_players to user_profile join
  
  ## Changes
  - Drop existing foreign key on game_players.user_id
  - Add foreign key from game_players.user_id to user_profile.id
  - This allows proper joining with user_profile table in queries
  
  ## Reasoning
  - user_profile.id references auth.users.id
  - game_players.user_id should reference user_profile.id for easy joins
  - Both ultimately point to the same auth.users record
*/

-- First, drop the existing foreign key if it exists
ALTER TABLE game_players 
  DROP CONSTRAINT IF EXISTS game_players_user_id_fkey;

-- Add new foreign key to user_profile
ALTER TABLE game_players 
  ADD CONSTRAINT game_players_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES user_profile(id) 
  ON DELETE CASCADE;