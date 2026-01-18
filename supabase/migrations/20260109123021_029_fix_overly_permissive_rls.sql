/*
  # Fix Overly Permissive RLS Policies

  ## Security Improvements
  
  1. **Restrict Previously Open Policies**
     - audit_log: Require valid user_id
     - game_events: Require user is a player in the room
     - game_turns: Require user is the player
     - notification_receipts: Require user ownership
     - referral_events: Require valid referrer

  2. **Consolidate Multiple Permissive Policies**
     - multiplayer_game_players: Merge UPDATE policies
*/

-- audit_log - Require valid user_id instead of allowing anything
DROP POLICY IF EXISTS "Anyone can insert audit log" ON audit_log;
CREATE POLICY "Authenticated users can insert audit log"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NOT NULL AND user_id = (select auth.uid()));

-- game_events - Require user is a player in the room
DROP POLICY IF EXISTS "Users can insert events" ON game_events;
CREATE POLICY "Players can insert events"
  ON game_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_players gp
      WHERE gp.room_id = game_events.room_id
      AND gp.user_id = (select auth.uid())
    )
  );

-- game_turns - Require user is the player
DROP POLICY IF EXISTS "Users can insert turns" ON game_turns;
CREATE POLICY "Players can insert turns"
  ON game_turns FOR INSERT
  TO authenticated
  WITH CHECK (
    player_id IN (
      SELECT id FROM game_players
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update turns for undo" ON game_turns;
CREATE POLICY "Players can undo own turns"
  ON game_turns FOR UPDATE
  TO authenticated
  USING (
    player_id IN (
      SELECT id FROM game_players
      WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    player_id IN (
      SELECT id FROM game_players
      WHERE user_id = (select auth.uid())
    )
  );

-- notification_receipts - Require user ownership
DROP POLICY IF EXISTS "System can insert receipts" ON notification_receipts;
CREATE POLICY "Users can insert own receipts"
  ON notification_receipts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- referral_events - Require valid referrer
DROP POLICY IF EXISTS "System can insert referral events" ON referral_events;
CREATE POLICY "Valid referrers can insert events"
  ON referral_events FOR INSERT
  TO authenticated
  WITH CHECK (referrer_id = (select auth.uid()));

-- multiplayer_game_players - Consolidate UPDATE policies
DROP POLICY IF EXISTS "Host can update any player" ON multiplayer_game_players;
DROP POLICY IF EXISTS "Users can update own player state" ON multiplayer_game_players;

CREATE POLICY "Users can update player state"
  ON multiplayer_game_players FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR
    game_id IN (
      SELECT id FROM multiplayer_games
      WHERE host_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR
    game_id IN (
      SELECT id FROM multiplayer_games
      WHERE host_user_id = (select auth.uid())
    )
  );
