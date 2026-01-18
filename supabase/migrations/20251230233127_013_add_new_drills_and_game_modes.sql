/*
  # Add New Drills and Game Modes from Competitor Analysis

  1. New Drills Added
    - Catch 40, High Score, Finish 50, JDC Challenge
    - 121 Game, Pristley's Triple 20, A1 Drill, Game 420

  2. New Game Modes Table
    - Cricket, Halve-It, Killer, Knockout, Shanghai

  3. Player Profiles Table
    - Support multiple dart setups per user

  4. Multiplayer Games Tables
    - Real-time multiplayer game tracking
*/

-- First ensure slug has unique constraint on drills
CREATE UNIQUE INDEX IF NOT EXISTS drills_slug_unique ON drills(slug);

-- Add new drills
DO $$
BEGIN
  INSERT INTO drills (name_key, desc_key, category, difficulty, estimated_minutes, config, slug, is_active, sort_order)
  VALUES 
    ('drill.general.catch40', 'drill.general.catch40.desc', 'general', 2, 10, 
     '{"goal": "Score exactly 40 with 3 darts", "rounds": 10, "target_score": 1000}',
     'catch-40', true, 100)
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO drills (name_key, desc_key, category, difficulty, estimated_minutes, config, slug, is_active, sort_order)
  VALUES 
    ('drill.scoring.highscore', 'drill.scoring.highscore.desc', 'triples', 2, 15,
     '{"goal": "Score as high as possible in 10 rounds", "rounds": 10, "target_score": 1800}',
     'high-score', true, 101)
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO drills (name_key, desc_key, category, difficulty, estimated_minutes, config, slug, is_active, sort_order)
  VALUES 
    ('drill.checkout.finish50', 'drill.checkout.finish50.desc', 'checkout', 2, 10,
     '{"goal": "Checkout from 50 in various ways", "rounds": 10, "targets": ["S10-D20", "S18-D16", "Bull"]}',
     'finish-50', true, 102)
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO drills (name_key, desc_key, category, difficulty, estimated_minutes, config, slug, is_active, sort_order)
  VALUES 
    ('drill.challenge.jdc', 'drill.challenge.jdc.desc', 'general', 3, 20,
     '{"goal": "Official JDC Challenge format", "rounds": 21, "format": "7 rounds each: T20, Bull, Doubles"}',
     'jdc-challenge', true, 103)
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO drills (name_key, desc_key, category, difficulty, estimated_minutes, config, slug, is_active, sort_order)
  VALUES 
    ('drill.checkout.game121', 'drill.checkout.game121.desc', 'checkout', 3, 15,
     '{"goal": "Practice the famous 121 checkout", "rounds": 10, "target": "T20-T11-D14"}',
     'game-121', true, 104)
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO drills (name_key, desc_key, category, difficulty, estimated_minutes, config, slug, is_active, sort_order)
  VALUES 
    ('drill.triples.pristley', 'drill.triples.pristley.desc', 'triples', 3, 15,
     '{"goal": "Hit 50 triple 20s as fast as possible", "target_hits": 50, "scoring": "Time-based"}',
     'pristley-triple', true, 105)
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO drills (name_key, desc_key, category, difficulty, estimated_minutes, config, slug, is_active, sort_order)
  VALUES 
    ('drill.general.a1drill', 'drill.general.a1drill.desc', 'general', 4, 20,
     '{"goal": "George Silberzahn Flight Ticket drill", "rounds": 20, "progressive": true}',
     'a1-drill', true, 106)
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO drills (name_key, desc_key, category, difficulty, estimated_minutes, config, slug, is_active, sort_order)
  VALUES 
    ('drill.scoring.game420', 'drill.scoring.game420.desc', 'triples', 2, 10,
     '{"goal": "Score exactly 420 points", "target": 420, "scoring": "Fewest darts wins"}',
     'game-420', true, 107)
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO drills (name_key, desc_key, category, difficulty, estimated_minutes, config, slug, is_active, sort_order)
  VALUES 
    ('drill.cricket.countup', 'drill.cricket.countup.desc', 'general', 2, 15,
     '{"goal": "Hit cricket numbers for points", "targets": [20,19,18,17,16,15,25], "rounds": 7}',
     'cricket-countup', true, 108)
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- Create game_modes table for multiplayer games
CREATE TABLE IF NOT EXISTS game_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name_key text NOT NULL,
  description_key text NOT NULL,
  category text NOT NULL DEFAULT 'classic',
  min_players integer NOT NULL DEFAULT 2,
  max_players integer NOT NULL DEFAULT 8,
  rules jsonb NOT NULL DEFAULT '{}',
  scoring_type text NOT NULL DEFAULT 'standard',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_modes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active game modes" ON game_modes;
CREATE POLICY "Anyone can view active game modes"
  ON game_modes FOR SELECT
  USING (is_active = true);

-- Insert game modes
INSERT INTO game_modes (slug, name_key, description_key, category, min_players, max_players, rules, scoring_type, sort_order)
VALUES
  ('x01-301', 'game.x01.301', 'game.x01.301.desc', 'x01', 1, 8, 
   '{"starting_score": 301, "double_in": false, "double_out": true}', 'countdown', 1),
  ('x01-501', 'game.x01.501', 'game.x01.501.desc', 'x01', 1, 8, 
   '{"starting_score": 501, "double_in": false, "double_out": true}', 'countdown', 2),
  ('x01-701', 'game.x01.701', 'game.x01.701.desc', 'x01', 1, 8, 
   '{"starting_score": 701, "double_in": false, "double_out": true}', 'countdown', 3),
  ('cricket-standard', 'game.cricket.standard', 'game.cricket.standard.desc', 'cricket', 2, 8,
   '{"numbers": [20,19,18,17,16,15,25], "points_mode": false, "cutthroat": false}', 'cricket', 10),
  ('cricket-cutthroat', 'game.cricket.cutthroat', 'game.cricket.cutthroat.desc', 'cricket', 3, 8,
   '{"numbers": [20,19,18,17,16,15,25], "points_mode": true, "cutthroat": true}', 'cricket', 11),
  ('halve-it', 'game.halveit', 'game.halveit.desc', 'party', 2, 8,
   '{"targets": [20,19,18,"Any Double",17,16,15,"Any Triple","Bull"], "halve_on_miss": true}', 'halveit', 20),
  ('killer', 'game.killer', 'game.killer.desc', 'party', 3, 10,
   '{"lives": 3, "assign_doubles": true}', 'killer', 21),
  ('knockout', 'game.knockout', 'game.knockout.desc', 'party', 3, 10,
   '{"elimination": true, "lowest_out": true}', 'knockout', 22),
  ('shanghai', 'game.shanghai', 'game.shanghai.desc', 'classic', 2, 8,
   '{"rounds": 20, "shanghai_wins": true}', 'shanghai', 30),
  ('around-clock', 'game.aroundclock', 'game.aroundclock.desc', 'classic', 1, 8,
   '{"target_sequence": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], "doubles_only": false}', 'sequence', 31)
ON CONFLICT (slug) DO NOTHING;

-- Create player_profiles table for different dart setups
CREATE TABLE IF NOT EXISTS player_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  dart_weight text,
  dart_brand text,
  dart_model text,
  flight_shape text,
  shaft_length text,
  is_default boolean NOT NULL DEFAULT false,
  stats jsonb DEFAULT '{"games_played": 0, "avg_score": 0, "checkout_rate": 0}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_profiles_user_id ON player_profiles(user_id);

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profiles" ON player_profiles;
CREATE POLICY "Users can view own profiles"
  ON player_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own profiles" ON player_profiles;
CREATE POLICY "Users can create own profiles"
  ON player_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profiles" ON player_profiles;
CREATE POLICY "Users can update own profiles"
  ON player_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profiles" ON player_profiles;
CREATE POLICY "Users can delete own profiles"
  ON player_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create multiplayer_games table
CREATE TABLE IF NOT EXISTS multiplayer_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_mode_id uuid NOT NULL REFERENCES game_modes(id),
  host_user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
  settings jsonb NOT NULL DEFAULT '{}',
  current_player_index integer NOT NULL DEFAULT 0,
  current_round integer NOT NULL DEFAULT 1,
  winner_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_multiplayer_games_status ON multiplayer_games(status);
CREATE INDEX IF NOT EXISTS idx_multiplayer_games_host ON multiplayer_games(host_user_id);

ALTER TABLE multiplayer_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view public waiting games" ON multiplayer_games;
CREATE POLICY "Users can view public waiting games"
  ON multiplayer_games FOR SELECT
  TO authenticated
  USING (status = 'waiting' OR host_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create games" ON multiplayer_games;
CREATE POLICY "Users can create games"
  ON multiplayer_games FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_user_id);

DROP POLICY IF EXISTS "Host can update own games" ON multiplayer_games;
CREATE POLICY "Host can update own games"
  ON multiplayer_games FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_user_id)
  WITH CHECK (auth.uid() = host_user_id);

-- Create multiplayer_game_players table
CREATE TABLE IF NOT EXISTS multiplayer_game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES multiplayer_games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  display_name text NOT NULL,
  player_order integer NOT NULL,
  score integer NOT NULL DEFAULT 0,
  state jsonb NOT NULL DEFAULT '{}',
  is_eliminated boolean NOT NULL DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(game_id, user_id),
  UNIQUE(game_id, player_order)
);

CREATE INDEX IF NOT EXISTS idx_multiplayer_game_players_game ON multiplayer_game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_multiplayer_game_players_user ON multiplayer_game_players(user_id);

ALTER TABLE multiplayer_game_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view game players" ON multiplayer_game_players;
CREATE POLICY "Users can view game players"
  ON multiplayer_game_players FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can join games" ON multiplayer_game_players;
CREATE POLICY "Users can join games"
  ON multiplayer_game_players FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own player state" ON multiplayer_game_players;
CREATE POLICY "Users can update own player state"
  ON multiplayer_game_players FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Host can update any player" ON multiplayer_game_players;
CREATE POLICY "Host can update any player"
  ON multiplayer_game_players FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM multiplayer_games g WHERE g.id = game_id AND g.host_user_id = auth.uid())
  );

-- Create multiplayer_game_turns table
CREATE TABLE IF NOT EXISTS multiplayer_game_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES multiplayer_games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES multiplayer_game_players(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  darts jsonb NOT NULL DEFAULT '[]',
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_multiplayer_game_turns_game ON multiplayer_game_turns(game_id);
CREATE INDEX IF NOT EXISTS idx_multiplayer_game_turns_player ON multiplayer_game_turns(player_id);

ALTER TABLE multiplayer_game_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view turns" ON multiplayer_game_turns;
CREATE POLICY "Users can view turns"
  ON multiplayer_game_turns FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Players can add turns" ON multiplayer_game_turns;
CREATE POLICY "Players can add turns"
  ON multiplayer_game_turns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM multiplayer_game_players p WHERE p.id = player_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM multiplayer_games g WHERE g.id = game_id AND g.host_user_id = auth.uid())
  );

-- Add caller settings to user_profile table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profile' AND column_name = 'caller_settings'
  ) THEN
    ALTER TABLE user_profile ADD COLUMN caller_settings jsonb DEFAULT '{"enabled": true, "voice": "default", "volume": 0.8}';
  END IF;
END $$;

-- Add profile_id to game_sessions if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'game_sessions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'game_sessions' AND column_name = 'profile_id'
    ) THEN
      ALTER TABLE game_sessions ADD COLUMN profile_id uuid REFERENCES player_profiles(id);
    END IF;
  END IF;
END $$;
