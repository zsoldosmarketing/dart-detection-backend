/*
  # Fix Game RLS Policies for PVP Games
  
  1. Changes
    - Update game_rooms RLS policies to allow all players in a room to view it
    - Update game_state RLS policies to allow all players in a room to update it
    - Fix issue where only room creator could see/update game state
  
  2. Security
    - Players can only see rooms they are playing in
    - Players can only update game state for rooms they are in
    - Maintains data security while enabling PVP functionality
*/

-- Drop existing restrictive policies on game_rooms
DROP POLICY IF EXISTS "Users can view their rooms" ON game_rooms;
DROP POLICY IF EXISTS "Users can update their rooms" ON game_rooms;

-- Create new policies that allow all players in a room to view it
CREATE POLICY "Players can view their game rooms"
  ON game_rooms FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM game_players 
      WHERE game_players.room_id = game_rooms.id 
      AND game_players.user_id = auth.uid()
    )
  );

-- Allow all players in a room to update it (for turn tracking, etc)
CREATE POLICY "Players can update their game rooms"
  ON game_rooms FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM game_players 
      WHERE game_players.room_id = game_rooms.id 
      AND game_players.user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM game_players 
      WHERE game_players.room_id = game_rooms.id 
      AND game_players.user_id = auth.uid()
    )
  );

-- Drop existing restrictive policies on game_state
DROP POLICY IF EXISTS "Users can update game state" ON game_state;

-- Allow all players in a room to update game state
CREATE POLICY "Players can update game state"
  ON game_state FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.room_id = game_state.room_id
      AND game_players.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.room_id = game_state.room_id
      AND game_players.user_id = auth.uid()
    )
  );

-- Drop existing restrictive policy on game_state insert
DROP POLICY IF EXISTS "Users can insert game state" ON game_state;

-- Allow players to insert game state if they are in the room
CREATE POLICY "Players can insert game state"
  ON game_state FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE game_rooms.id = game_state.room_id
      AND (
        game_rooms.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM game_players
          WHERE game_players.room_id = game_rooms.id
          AND game_players.user_id = auth.uid()
        )
      )
    )
  );