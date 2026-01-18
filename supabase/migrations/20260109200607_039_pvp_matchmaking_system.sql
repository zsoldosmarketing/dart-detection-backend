/*
  # PVP Matchmaking System

  1. New Tables
    - `pvp_lobby` - Players waiting for opponents
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profile)
      - `game_type` (text) - x01, cricket, etc.
      - `starting_score` (int) - for x01 games
      - `legs_to_win` (int)
      - `sets_to_win` (int)
      - `double_in` (boolean)
      - `double_out` (boolean)
      - `skill_filter` (text) - similar, higher, lower, any
      - `status` (text) - waiting, matched, cancelled
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)
    
    - `pvp_challenges` - Challenge requests between players
      - `id` (uuid, primary key)
      - `challenger_id` (uuid, references user_profile)
      - `opponent_id` (uuid, references user_profile)
      - `lobby_id` (uuid, references pvp_lobby)
      - `room_id` (uuid, references game_rooms)
      - `status` (text) - pending, accepted, declined, expired
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)

    - `game_invites` - Direct friend invites (if not exists)
      - Similar structure for direct friend invites

  2. Security
    - Enable RLS on all tables
    - Users can view their own lobby entries and challenges
    - Users can create challenges to other players
    - Users can accept/decline challenges sent to them

  3. Indexes
    - Index on lobby status and skill filter for matchmaking
    - Index on challenges for quick lookup
*/

-- PVP Lobby table
CREATE TABLE IF NOT EXISTS pvp_lobby (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  game_type text NOT NULL DEFAULT 'x01',
  starting_score int NOT NULL DEFAULT 501,
  legs_to_win int NOT NULL DEFAULT 1,
  sets_to_win int NOT NULL DEFAULT 1,
  double_in boolean DEFAULT false,
  double_out boolean DEFAULT true,
  skill_filter text NOT NULL DEFAULT 'any' CHECK (skill_filter IN ('similar', 'higher', 'lower', 'any')),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'cancelled', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 minutes')
);

-- PVP Challenges table
CREATE TABLE IF NOT EXISTS pvp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  lobby_id uuid REFERENCES pvp_lobby(id) ON DELETE CASCADE,
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '10 minutes'),
  CHECK (challenger_id != opponent_id)
);

-- Game invites table (if not exists)
CREATE TABLE IF NOT EXISTS game_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '15 minutes'),
  CHECK (inviter_id != invitee_id)
);

-- Enable RLS
ALTER TABLE pvp_lobby ENABLE ROW LEVEL SECURITY;
ALTER TABLE pvp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pvp_lobby
CREATE POLICY "Users can view active lobby entries"
  ON pvp_lobby FOR SELECT
  TO authenticated
  USING (status = 'waiting' OR user_id = auth.uid());

CREATE POLICY "Users can create own lobby entries"
  ON pvp_lobby FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lobby entries"
  ON pvp_lobby FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lobby entries"
  ON pvp_lobby FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for pvp_challenges
CREATE POLICY "Users can view relevant challenges"
  ON pvp_challenges FOR SELECT
  TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "Users can create challenges"
  ON pvp_challenges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Challenge recipients can update"
  ON pvp_challenges FOR UPDATE
  TO authenticated
  USING (auth.uid() = opponent_id OR auth.uid() = challenger_id)
  WITH CHECK (auth.uid() = opponent_id OR auth.uid() = challenger_id);

CREATE POLICY "Users can delete own challenges"
  ON pvp_challenges FOR DELETE
  TO authenticated
  USING (auth.uid() = challenger_id);

-- RLS Policies for game_invites
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_invites' 
    AND policyname = 'Users can view relevant invites'
  ) THEN
    CREATE POLICY "Users can view relevant invites"
      ON game_invites FOR SELECT
      TO authenticated
      USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_invites' 
    AND policyname = 'Users can create invites'
  ) THEN
    CREATE POLICY "Users can create invites"
      ON game_invites FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = inviter_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'game_invites' 
    AND policyname = 'Invitees can update invites'
  ) THEN
    CREATE POLICY "Invitees can update invites"
      ON game_invites FOR UPDATE
      TO authenticated
      USING (auth.uid() = invitee_id)
      WITH CHECK (auth.uid() = invitee_id);
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pvp_lobby_status ON pvp_lobby(status) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_pvp_lobby_user ON pvp_lobby(user_id);
CREATE INDEX IF NOT EXISTS idx_pvp_lobby_skill_filter ON pvp_lobby(skill_filter) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_pvp_challenges_opponent ON pvp_challenges(opponent_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pvp_challenges_challenger ON pvp_challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_game_invites_invitee ON game_invites(invitee_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_game_invites_inviter ON game_invites(inviter_id);

-- Function to clean up expired lobby entries
CREATE OR REPLACE FUNCTION cleanup_expired_pvp_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Expire old lobby entries
  UPDATE pvp_lobby
  SET status = 'expired'
  WHERE status = 'waiting' AND expires_at < now();

  -- Expire old challenges
  UPDATE pvp_challenges
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();

  -- Expire old game invites
  UPDATE game_invites
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();
END;
$$;