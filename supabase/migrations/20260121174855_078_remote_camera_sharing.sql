/*
  # Remote Camera Sharing System

  This migration creates the infrastructure for sharing camera streams between devices
  using WebRTC with Supabase Realtime for signaling.

  ## New Tables

  1. `remote_camera_sessions`
    - `id` (uuid, primary key) - Session identifier
    - `user_id` (uuid, foreign key) - Owner of the camera share
    - `device_name` (text) - Name of the device sharing camera
    - `device_type` (text) - Type: 'phone', 'tablet', 'desktop'
    - `status` (text) - Status: 'waiting', 'connected', 'disconnected'
    - `sdp_offer` (text) - WebRTC SDP offer from camera device
    - `sdp_answer` (text) - WebRTC SDP answer from viewer device
    - `created_at` (timestamptz) - Session creation time
    - `updated_at` (timestamptz) - Last update time
    - `expires_at` (timestamptz) - Session expiration time

  2. `remote_camera_ice_candidates`
    - `id` (uuid, primary key) - Candidate identifier
    - `session_id` (uuid, foreign key) - Related session
    - `candidate` (jsonb) - ICE candidate data
    - `from_device` (text) - 'camera' or 'viewer'
    - `created_at` (timestamptz) - Creation time

  ## Security
  - RLS enabled on both tables
  - Users can only access their own camera sessions
  - Realtime enabled for signaling
*/

-- Remote camera sessions table
CREATE TABLE IF NOT EXISTS remote_camera_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name text NOT NULL DEFAULT 'Unknown Device',
  device_type text NOT NULL DEFAULT 'phone' CHECK (device_type IN ('phone', 'tablet', 'desktop')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'connected', 'disconnected')),
  sdp_offer text,
  sdp_answer text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour')
);

-- ICE candidates table for WebRTC signaling
CREATE TABLE IF NOT EXISTS remote_camera_ice_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES remote_camera_sessions(id) ON DELETE CASCADE,
  candidate jsonb NOT NULL,
  from_device text NOT NULL CHECK (from_device IN ('camera', 'viewer')),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_remote_camera_sessions_user_id ON remote_camera_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_remote_camera_sessions_status ON remote_camera_sessions(status);
CREATE INDEX IF NOT EXISTS idx_remote_camera_sessions_expires_at ON remote_camera_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_remote_camera_ice_candidates_session_id ON remote_camera_ice_candidates(session_id);

-- Enable RLS
ALTER TABLE remote_camera_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE remote_camera_ice_candidates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for remote_camera_sessions
CREATE POLICY "Users can view their own camera sessions"
  ON remote_camera_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own camera sessions"
  ON remote_camera_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own camera sessions"
  ON remote_camera_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own camera sessions"
  ON remote_camera_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for remote_camera_ice_candidates
CREATE POLICY "Users can view ICE candidates for their sessions"
  ON remote_camera_ice_candidates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM remote_camera_sessions
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ICE candidates for their sessions"
  ON remote_camera_ice_candidates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM remote_camera_sessions
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete ICE candidates for their sessions"
  ON remote_camera_ice_candidates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM remote_camera_sessions
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

-- Enable Realtime for signaling
ALTER PUBLICATION supabase_realtime ADD TABLE remote_camera_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE remote_camera_ice_candidates;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_camera_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM remote_camera_sessions
  WHERE expires_at < now();
END;
$$;
