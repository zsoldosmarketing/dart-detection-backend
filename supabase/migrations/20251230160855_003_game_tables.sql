/*
  # Game System Tables
  
  ## Tables Created
  - game_rooms - Active game sessions
  - game_players - Players in game rooms
  - game_state - Current game state
  - game_turns - Turn history
  - game_events - Game event log
  - game_invites - Game invitations
  
  ## Security
  - RLS enabled on all tables
*/

CREATE TABLE IF NOT EXISTS game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type text DEFAULT 'x01' CHECK (game_type IN ('x01', 'cricket', 'around_the_clock')),
  starting_score integer DEFAULT 501,
  legs_to_win integer DEFAULT 1,
  sets_to_win integer DEFAULT 1,
  double_in boolean DEFAULT false,
  double_out boolean DEFAULT true,
  mode text DEFAULT 'bot' CHECK (mode IN ('bot', 'pvp', 'local')),
  bot_difficulty text CHECK (bot_difficulty IN ('easy', 'medium', 'hard', 'pro')),
  bot_style text,
  bot_params jsonb,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'abandoned')),
  winner_id uuid REFERENCES auth.users(id),
  tournament_match_id uuid,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their rooms"
  ON game_rooms FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create game rooms"
  ON game_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their rooms"
  ON game_rooms FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_bot boolean DEFAULT false,
  player_order integer NOT NULL,
  current_score integer,
  legs_won integer DEFAULT 0,
  sets_won integer DEFAULT 0,
  is_connected boolean DEFAULT true,
  last_ping_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view players in rooms"
  ON game_players FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert players"
  ON game_players FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR is_bot = true);

CREATE POLICY "Users can update their player record"
  ON game_players FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_bot = true)
  WITH CHECK (user_id = auth.uid() OR is_bot = true);

CREATE TABLE IF NOT EXISTS game_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE UNIQUE,
  current_player_order integer DEFAULT 1,
  current_leg integer DEFAULT 1,
  current_set integer DEFAULT 1,
  darts_thrown_this_turn integer DEFAULT 0,
  turn_score integer DEFAULT 0,
  turn_darts jsonb DEFAULT '[]'::jsonb,
  is_bust boolean DEFAULT false,
  leg_starting_player integer DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view game state"
  ON game_state FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert game state"
  ON game_state FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE game_rooms.id = game_state.room_id
      AND game_rooms.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update game state"
  ON game_state FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE game_rooms.id = game_state.room_id
      AND game_rooms.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE game_rooms.id = game_state.room_id
      AND game_rooms.created_by = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS game_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id uuid REFERENCES game_players(id) ON DELETE CASCADE,
  leg_number integer NOT NULL,
  set_number integer NOT NULL,
  turn_number integer NOT NULL,
  darts jsonb NOT NULL,
  total_score integer NOT NULL,
  remaining_before integer NOT NULL,
  remaining_after integer NOT NULL,
  is_checkout boolean DEFAULT false,
  is_bust boolean DEFAULT false,
  is_undone boolean DEFAULT false,
  undone_by uuid REFERENCES auth.users(id),
  undone_at timestamptz,
  undo_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view turns"
  ON game_turns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert turns"
  ON game_turns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update turns for undo"
  ON game_turns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS game_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  player_id uuid REFERENCES game_players(id),
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events"
  ON game_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert events"
  ON game_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS game_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their invites"
  ON game_invites FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

CREATE POLICY "Users can create invites"
  ON game_invites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Invitees can update invites"
  ON game_invites FOR UPDATE
  TO authenticated
  USING (auth.uid() = invitee_id)
  WITH CHECK (auth.uid() = invitee_id);

CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_rooms_created_by ON game_rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_game_players_room ON game_players(room_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_game_turns_room ON game_turns(room_id);
CREATE INDEX IF NOT EXISTS idx_game_invites_invitee ON game_invites(invitee_id, status);