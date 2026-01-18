/*
  # Add display_name to game_players
  
  ## Changes
  - Add display_name column to game_players table
  - This allows storing custom names for local/unregistered players
  
  ## Usage
  - For registered users: display_name can override the profile name
  - For local/guest players: display_name stores their custom name
*/

ALTER TABLE game_players 
ADD COLUMN IF NOT EXISTS display_name text;