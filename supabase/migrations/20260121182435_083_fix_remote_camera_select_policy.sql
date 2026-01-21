/*
  # Fix Remote Camera Sessions SELECT Policy

  1. Security Fix
    - Changed SELECT policy to only allow users to view their OWN camera sessions
    - Previously allowed all authenticated users to see all sessions (security risk)

  2. Notes
    - Users can only see sessions where they are the owner (user_id matches)
    - This ensures privacy - users cannot see other users' camera sessions
*/

DROP POLICY IF EXISTS "Authenticated users can view camera sessions" ON remote_camera_sessions;

CREATE POLICY "Users can view own camera sessions"
  ON remote_camera_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
