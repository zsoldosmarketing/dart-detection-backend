/*
  # Direct Challenges and Game Resume System

  1. Changes to pvp_challenges
    - Add `challenge_type` to distinguish between lobby-based and direct challenges
    - Add game settings for direct challenges (starting_score, legs_to_win, etc.)
    - These allow direct challenges without needing a lobby entry

  2. New Table: game_resume_requests
    - Stores requests to resume paused/disconnected games
    - Has 2-minute expiration for responses
    - Tracks which player sent the resume request

  3. Changes to game_rooms
    - Update resume_deadline to 3 minutes for disconnects (was 10 minutes)

  4. Changes to game_state
    - Add `turn_started_at` for turn timer tracking (1-minute limit per turn)
    - Add `last_activity_at` to track player activity

  5. Security
    - RLS enabled on new tables
    - Policies for authenticated users only
*/

-- Add challenge_type to pvp_challenges
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pvp_challenges' AND column_name = 'challenge_type'
  ) THEN
    ALTER TABLE pvp_challenges ADD COLUMN challenge_type text NOT NULL DEFAULT 'lobby' CHECK (challenge_type IN ('lobby', 'direct'));
  END IF;
END $$;

-- Add game settings to pvp_challenges for direct challenges
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pvp_challenges' AND column_name = 'starting_score'
  ) THEN
    ALTER TABLE pvp_challenges ADD COLUMN starting_score integer DEFAULT 501;
    ALTER TABLE pvp_challenges ADD COLUMN legs_to_win integer DEFAULT 1;
    ALTER TABLE pvp_challenges ADD COLUMN sets_to_win integer DEFAULT 1;
    ALTER TABLE pvp_challenges ADD COLUMN double_in boolean DEFAULT false;
    ALTER TABLE pvp_challenges ADD COLUMN double_out boolean DEFAULT true;
    ALTER TABLE pvp_challenges ADD COLUMN game_type text DEFAULT 'x01';
  END IF;
END $$;

-- Create game_resume_requests table
CREATE TABLE IF NOT EXISTS game_resume_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '2 minutes'),
  responded_at timestamptz,
  UNIQUE(room_id, requester_id)
);

ALTER TABLE game_resume_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resume requests"
  ON game_resume_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = opponent_id);

CREATE POLICY "Users can create resume requests"
  ON game_resume_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update own resume requests"
  ON game_resume_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = opponent_id OR auth.uid() = requester_id);

-- Add turn timer tracking to game_state
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_state' AND column_name = 'turn_started_at'
  ) THEN
    ALTER TABLE game_state ADD COLUMN turn_started_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_state' AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE game_state ADD COLUMN last_activity_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add opponent_display_name to game_rooms for easy access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_rooms' AND column_name = 'cached_data'
  ) THEN
    ALTER TABLE game_rooms ADD COLUMN cached_data jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_resume_requests_room_id ON game_resume_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_game_resume_requests_requester_id ON game_resume_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_game_resume_requests_opponent_id ON game_resume_requests(opponent_id);
CREATE INDEX IF NOT EXISTS idx_game_resume_requests_status ON game_resume_requests(status);
CREATE INDEX IF NOT EXISTS idx_game_resume_requests_expires_at ON game_resume_requests(expires_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pvp_challenges_challenge_type ON pvp_challenges(challenge_type);
CREATE INDEX IF NOT EXISTS idx_game_state_turn_started_at ON game_state(turn_started_at) WHERE turn_started_at IS NOT NULL;

-- Function to cleanup expired resume requests
CREATE OR REPLACE FUNCTION cleanup_expired_resume_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE game_resume_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$;

-- Function to update disconnect timeout to 3 minutes
CREATE OR REPLACE FUNCTION update_disconnect_timeouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update any currently paused games to use 3 minute timeout
  UPDATE game_rooms
  SET resume_deadline = paused_at + interval '3 minutes'
  WHERE status = 'paused_disconnect'
    AND pause_reason = 'disconnect'
    AND resume_deadline > now()
    AND paused_at IS NOT NULL;
END;
$$;

-- Function to check for turn timeouts (1 minute per turn in online games)
CREATE OR REPLACE FUNCTION check_turn_timeouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For online PVP games where turn has exceeded 1 minute, mark as timed out
  -- This will be handled by the client/game logic
  UPDATE game_state gs
  SET last_activity_at = now()
  FROM game_rooms gr
  WHERE gs.room_id = gr.id
    AND gr.mode = 'pvp'
    AND gr.status = 'in_progress'
    AND gs.turn_started_at IS NOT NULL
    AND gs.turn_started_at < now() - interval '1 minute';
END;
$$;