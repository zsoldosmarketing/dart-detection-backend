/*
  # Tournament System Tables
  
  ## Tables Created
  - tournaments - Tournament definitions
  - tournament_entries - Player entries
  - tournament_brackets - Bracket structure
  - tournament_matches - Match records
  - tournament_events - Tournament event log
  - tournament_finance - Token economy (inactive scaffold)
  
  ## Security
  - RLS enabled on all tables
*/

CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  game_type text DEFAULT 'x01',
  starting_score integer DEFAULT 501,
  legs_per_match integer DEFAULT 3,
  sets_per_match integer DEFAULT 1,
  format text DEFAULT 'single_elimination' CHECK (format IN ('single_elimination', 'double_elimination', 'round_robin')),
  min_players integer DEFAULT 4,
  max_players integer DEFAULT 32,
  min_skill_rating numeric,
  max_skill_rating numeric,
  entry_fee_tokens integer DEFAULT 0,
  prize_pool_tokens integer DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'registration', 'in_progress', 'completed', 'cancelled')),
  registration_starts_at timestamptz,
  registration_ends_at timestamptz,
  starts_at timestamptz,
  completed_at timestamptz,
  winner_id uuid REFERENCES auth.users(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  club_id uuid REFERENCES clubs(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournaments"
  ON tournaments FOR SELECT
  TO authenticated
  USING (status != 'draft' OR created_by = auth.uid());

CREATE POLICY "Host can create tournaments"
  ON tournaments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Host can update tournaments"
  ON tournaments FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'eliminated', 'winner', 'withdrawn', 'disqualified')),
  seed integer,
  final_position integer,
  registered_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view entries"
  ON tournament_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can register"
  ON tournament_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entry"
  ON tournament_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS tournament_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  match_number integer NOT NULL,
  player1_entry_id uuid REFERENCES tournament_entries(id),
  player2_entry_id uuid REFERENCES tournament_entries(id),
  winner_entry_id uuid REFERENCES tournament_entries(id),
  next_match_id uuid REFERENCES tournament_brackets(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'in_progress', 'completed', 'bye')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tournament_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view brackets"
  ON tournament_brackets FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  bracket_id uuid REFERENCES tournament_brackets(id) ON DELETE CASCADE,
  game_room_id uuid REFERENCES game_rooms(id),
  player1_id uuid REFERENCES auth.users(id),
  player2_id uuid REFERENCES auth.users(id),
  winner_id uuid REFERENCES auth.users(id),
  player1_legs integer DEFAULT 0,
  player2_legs integer DEFAULT 0,
  player1_sets integer DEFAULT 0,
  player2_sets integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'invited', 'in_progress', 'completed', 'forfeit', 'timeout')),
  invite_sent_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view matches"
  ON tournament_matches FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS tournament_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  match_id uuid REFERENCES tournament_matches(id),
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tournament_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournament events"
  ON tournament_events FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS tournament_finance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE UNIQUE,
  entry_fee_tokens integer DEFAULT 0,
  platform_fee_percent numeric DEFAULT 10,
  total_entries integer DEFAULT 0,
  total_collected integer DEFAULT 0,
  platform_fee_amount integer DEFAULT 0,
  prize_pool_amount integer DEFAULT 0,
  distribution_json jsonb,
  settled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tournament_finance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view finance"
  ON tournament_finance FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_tournament ON tournament_brackets(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);