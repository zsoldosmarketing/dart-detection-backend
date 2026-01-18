/*
  # Fix RLS Policy Performance Issues

  1. Optimize RLS Policies
    - Replace auth.uid() with (SELECT auth.uid()) in all policies
    - This prevents re-evaluation of auth functions for each row
    - Significantly improves query performance at scale

  2. Tables Affected
    - training_sessions
    - game_state
    - game_rooms
    - tournaments
    - game_resume_requests
    - program_enrollments
    - voice_settings
*/

-- =====================================================
-- SECTION 1: Fix training_sessions RLS Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can delete own training sessions" ON training_sessions;

CREATE POLICY "Users can delete own training sessions"
  ON training_sessions
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- =====================================================
-- SECTION 2: Fix game_state RLS Policies
-- =====================================================

DROP POLICY IF EXISTS "Players can insert game state" ON game_state;
DROP POLICY IF EXISTS "Players can update game state" ON game_state;

CREATE POLICY "Players can insert game state"
  ON game_state
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.room_id = game_state.room_id
      AND game_players.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Players can update game state"
  ON game_state
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.room_id = game_state.room_id
      AND game_players.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.room_id = game_state.room_id
      AND game_players.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- SECTION 3: Fix game_rooms RLS Policies
-- =====================================================

DROP POLICY IF EXISTS "Players can update their game rooms" ON game_rooms;
DROP POLICY IF EXISTS "Players can view their game rooms" ON game_rooms;

CREATE POLICY "Players can update their game rooms"
  ON game_rooms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.room_id = game_rooms.id
      AND game_players.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.room_id = game_rooms.id
      AND game_players.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Players can view their game rooms"
  ON game_rooms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.room_id = game_rooms.id
      AND game_players.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- SECTION 4: Fix tournaments RLS Policies
-- =====================================================

DROP POLICY IF EXISTS "Host can delete tournaments before they start" ON tournaments;

CREATE POLICY "Host can delete tournaments before they start"
  ON tournaments
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = created_by AND status = 'draft');

-- =====================================================
-- SECTION 5: Fix game_resume_requests RLS Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create resume requests" ON game_resume_requests;
DROP POLICY IF EXISTS "Users can update own resume requests" ON game_resume_requests;
DROP POLICY IF EXISTS "Users can view own resume requests" ON game_resume_requests;

CREATE POLICY "Users can create resume requests"
  ON game_resume_requests
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = requester_id);

CREATE POLICY "Users can update own resume requests"
  ON game_resume_requests
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = requester_id OR (SELECT auth.uid()) = opponent_id)
  WITH CHECK ((SELECT auth.uid()) = requester_id OR (SELECT auth.uid()) = opponent_id);

CREATE POLICY "Users can view own resume requests"
  ON game_resume_requests
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = requester_id OR (SELECT auth.uid()) = opponent_id);

-- =====================================================
-- SECTION 6: Fix program_enrollments RLS Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can delete their enrollments" ON program_enrollments;

CREATE POLICY "Users can delete their enrollments"
  ON program_enrollments
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- =====================================================
-- SECTION 7: Fix voice_settings RLS Policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own voice settings" ON voice_settings;
DROP POLICY IF EXISTS "Users can read own voice settings" ON voice_settings;
DROP POLICY IF EXISTS "Users can update own voice settings" ON voice_settings;

CREATE POLICY "Users can read own voice settings"
  ON voice_settings
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own voice settings"
  ON voice_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own voice settings"
  ON voice_settings
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);