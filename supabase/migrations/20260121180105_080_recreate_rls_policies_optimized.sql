/*
  # Recreate RLS Policies with Optimized Auth Calls

  This migration drops and recreates all RLS policies on remote_camera_sessions
  and remote_camera_ice_candidates tables to ensure they use the optimized
  (select auth.uid()) pattern instead of direct auth.uid() calls.

  1. Tables Affected
    - remote_camera_sessions
    - remote_camera_ice_candidates

  2. Changes
    - All policies recreated with (select auth.uid()) for performance
*/

-- Drop all existing policies on remote_camera_sessions
DROP POLICY IF EXISTS "Users can view their own camera sessions" ON remote_camera_sessions;
DROP POLICY IF EXISTS "Users can create their own camera sessions" ON remote_camera_sessions;
DROP POLICY IF EXISTS "Users can update their own camera sessions" ON remote_camera_sessions;
DROP POLICY IF EXISTS "Users can delete their own camera sessions" ON remote_camera_sessions;

-- Recreate policies with explicit (select auth.uid()) pattern
CREATE POLICY "Optimized view own camera sessions"
  ON remote_camera_sessions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Optimized create own camera sessions"
  ON remote_camera_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Optimized update own camera sessions"
  ON remote_camera_sessions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Optimized delete own camera sessions"
  ON remote_camera_sessions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Drop all existing policies on remote_camera_ice_candidates
DROP POLICY IF EXISTS "Users can view ICE candidates for their sessions" ON remote_camera_ice_candidates;
DROP POLICY IF EXISTS "Users can insert ICE candidates for their sessions" ON remote_camera_ice_candidates;
DROP POLICY IF EXISTS "Users can delete ICE candidates for their sessions" ON remote_camera_ice_candidates;

-- Recreate policies with explicit (select auth.uid()) pattern
CREATE POLICY "Optimized view ICE candidates"
  ON remote_camera_ice_candidates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM remote_camera_sessions s
      WHERE s.id = remote_camera_ice_candidates.session_id 
        AND s.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Optimized insert ICE candidates"
  ON remote_camera_ice_candidates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM remote_camera_sessions s
      WHERE s.id = remote_camera_ice_candidates.session_id 
        AND s.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Optimized delete ICE candidates"
  ON remote_camera_ice_candidates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM remote_camera_sessions s
      WHERE s.id = remote_camera_ice_candidates.session_id 
        AND s.user_id = (select auth.uid())
    )
  );

-- Recreate function with immutable search_path
DROP FUNCTION IF EXISTS cleanup_expired_camera_sessions();

CREATE FUNCTION cleanup_expired_camera_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM remote_camera_sessions
  WHERE expires_at < now();
END;
$$;
