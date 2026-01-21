/*
  # Fix Remote Camera RLS Policies for Viewer Access

  1. Problem
    - Current policies only allow session owner to update their session
    - Viewer needs to update sdp_answer on sessions they want to connect to
    - Viewer needs to insert ICE candidates for sessions they connect to

  2. Changes
    - Allow authenticated users to view any session (needed to connect)
    - Allow authenticated users to update sdp_answer on any session
    - Allow authenticated users to insert/view ICE candidates for any session
    - Session deletion still restricted to owner only
*/

-- Drop current policies on remote_camera_sessions
DROP POLICY IF EXISTS "Optimized view own camera sessions" ON remote_camera_sessions;
DROP POLICY IF EXISTS "Optimized create own camera sessions" ON remote_camera_sessions;
DROP POLICY IF EXISTS "Optimized update own camera sessions" ON remote_camera_sessions;
DROP POLICY IF EXISTS "Optimized delete own camera sessions" ON remote_camera_sessions;

-- New policies: Owner creates, anyone authenticated can view/connect
CREATE POLICY "Owner can create camera sessions"
  ON remote_camera_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Authenticated users can view camera sessions"
  ON remote_camera_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update camera sessions"
  ON remote_camera_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Owner can delete camera sessions"
  ON remote_camera_sessions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Drop current policies on remote_camera_ice_candidates
DROP POLICY IF EXISTS "Optimized view ICE candidates" ON remote_camera_ice_candidates;
DROP POLICY IF EXISTS "Optimized insert ICE candidates" ON remote_camera_ice_candidates;
DROP POLICY IF EXISTS "Optimized delete ICE candidates" ON remote_camera_ice_candidates;

-- New policies: Anyone authenticated can view/insert ICE candidates
CREATE POLICY "Authenticated users can view ICE candidates"
  ON remote_camera_ice_candidates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert ICE candidates"
  ON remote_camera_ice_candidates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM remote_camera_sessions s
      WHERE s.id = remote_camera_ice_candidates.session_id
    )
  );

CREATE POLICY "Session owner can delete ICE candidates"
  ON remote_camera_ice_candidates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM remote_camera_sessions s
      WHERE s.id = remote_camera_ice_candidates.session_id 
        AND s.user_id = (select auth.uid())
    )
  );
