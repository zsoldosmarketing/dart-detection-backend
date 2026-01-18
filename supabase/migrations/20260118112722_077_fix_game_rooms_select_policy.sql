/*
  # Fix game_rooms SELECT policy
  
  1. Problem
    - Current SELECT policy only allows users who are in game_players table
    - But when creating a room, the user is not yet in game_players
    - This causes INSERT...SELECT to fail
  
  2. Solution
    - Update SELECT policy to also allow room creator to view their own rooms
    - This enables the INSERT...RETURNING pattern to work correctly
*/

DROP POLICY IF EXISTS "Players can view their game rooms" ON game_rooms;

CREATE POLICY "Players can view their game rooms"
  ON game_rooms FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.room_id = game_rooms.id
      AND game_players.user_id = (SELECT auth.uid())
    )
  );