/*
  # Game Camera Sessions for Online PVP

  1. New Tables
    - `game_camera_sessions`
      - `id` (uuid, primary key)
      - `room_id` (uuid, FK to game_rooms) - the game this camera session belongs to
      - `user_id` (uuid, FK to auth.users) - the player sharing their camera
      - `status` (text) - 'waiting', 'connected', 'disconnected'
      - `sdp_offer` (text) - WebRTC SDP offer
      - `sdp_answer` (text) - WebRTC SDP answer
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `game_camera_ice_candidates`
      - `id` (uuid, primary key)
      - `session_id` (uuid, FK to game_camera_sessions)
      - `candidate` (jsonb) - ICE candidate data
      - `from_user_id` (uuid) - which player sent the candidate
      - `created_at` (timestamptz)

  2. Modified Tables
    - `game_rooms`: Added `require_camera` boolean column

  3. Security
    - RLS enabled on both tables
    - Only game participants can access their game camera sessions
    - ICE candidates restricted to session participants

  4. Notes
    - Allows players in online games to share live camera feeds
    - WebRTC signaling is done through Supabase Realtime
    - Camera sharing can be optional or required per game
*/

-- Add require_camera column to game_rooms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_rooms' AND column_name = 'require_camera'
  ) THEN
    ALTER TABLE game_rooms ADD COLUMN require_camera boolean DEFAULT false;
  END IF;
END $$;

-- Game camera sessions table
CREATE TABLE IF NOT EXISTS game_camera_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting',
  sdp_offer text,
  sdp_answer text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE game_camera_sessions ENABLE ROW LEVEL SECURITY;

-- Game camera ICE candidates table
CREATE TABLE IF NOT EXISTS game_camera_ice_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES game_camera_sessions(id) ON DELETE CASCADE,
  candidate jsonb NOT NULL,
  from_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_camera_ice_candidates ENABLE ROW LEVEL SECURITY;

-- RLS: game_camera_sessions - players in the game can see/manage sessions
CREATE POLICY "Game participants can view camera sessions"
  ON game_camera_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players gp
      WHERE gp.room_id = game_camera_sessions.room_id
      AND gp.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can create their own camera session"
  ON game_camera_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM game_players gp
      WHERE gp.room_id = game_camera_sessions.room_id
      AND gp.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can update their own camera session"
  ON game_camera_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Opponents can set SDP answer on camera session"
  ON game_camera_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players gp
      WHERE gp.room_id = game_camera_sessions.room_id
      AND gp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_players gp
      WHERE gp.room_id = game_camera_sessions.room_id
      AND gp.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can delete their own camera session"
  ON game_camera_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS: game_camera_ice_candidates
CREATE POLICY "Game participants can view ICE candidates"
  ON game_camera_ice_candidates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_camera_sessions gcs
      JOIN game_players gp ON gp.room_id = gcs.room_id
      WHERE gcs.id = game_camera_ice_candidates.session_id
      AND gp.user_id = auth.uid()
    )
  );

CREATE POLICY "Game participants can insert ICE candidates"
  ON game_camera_ice_candidates FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = from_user_id
    AND EXISTS (
      SELECT 1 FROM game_camera_sessions gcs
      JOIN game_players gp ON gp.room_id = gcs.room_id
      WHERE gcs.id = game_camera_ice_candidates.session_id
      AND gp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own ICE candidates"
  ON game_camera_ice_candidates FOR DELETE
  TO authenticated
  USING (auth.uid() = from_user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_camera_sessions_room ON game_camera_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_camera_sessions_user ON game_camera_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_camera_ice_session ON game_camera_ice_candidates(session_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE game_camera_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE game_camera_ice_candidates;
