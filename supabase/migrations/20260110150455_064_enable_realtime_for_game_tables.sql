/*
  # Enable Realtime for Game Tables
  
  1. Changes
    - Add game_state, game_players, and game_rooms to supabase_realtime publication
    - Set REPLICA IDENTITY FULL for these tables to broadcast full row changes
    - This enables realtime subscriptions to work properly for PVP games
  
  2. Why This is Needed
    - Without adding tables to the publication, realtime subscriptions won't receive updates
    - REPLICA IDENTITY FULL ensures UPDATE events include both old and new values
    - This is critical for player turn switching to work across devices
*/

-- Set REPLICA IDENTITY FULL for game tables
-- This ensures realtime broadcasts include all column values
ALTER TABLE game_state REPLICA IDENTITY FULL;
ALTER TABLE game_players REPLICA IDENTITY FULL;
ALTER TABLE game_rooms REPLICA IDENTITY FULL;
ALTER TABLE game_turns REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication
-- This enables realtime subscriptions for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE game_turns;