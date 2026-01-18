/*
  # Comprehensive Statistics System

  ## Overview
  Átfogó statisztikai rendszer minden dobás és teljesítményadat nyomonkövetésére.

  ## Tables Created

  ### 1. dart_throws
  Minden egyes dobás részletes eseménye (a legalacsonyabb szintű adat)
  - Tartalmazza: célzott szektor, talált érték, játék kontextus, időbélyeg
  - Support: x01, cricket, training módok

  ### 2. leg_statistics
  Leg szintű összesített statisztikák
  - 3-dart average, first 9, checkout stats, visit breakdown

  ### 3. match_statistics
  Meccs szintű teljesítmény
  - Match average, leg count, set count, win/loss

  ### 4. player_statistics_summary
  Aggregált statisztikák különböző időszakokra (all-time, 90d, 30d, 7d)
  - Doubles/Triples hit%, checkout%, visit distributions

  ### 5. checkout_attempts
  Részletes kiszálló próbálkozások
  - Minden checkout attempt, result, darts used, double accuracy

  ### 6. training_drill_statistics
  Gyakorló módok teljesítménye
  - Drill-specifikus metrikák, progress tracking

  ### 7. double_statistics
  Dupla-specifikus teljesítmény nyomonkövetés
  - D1-D20 és bull statisztikák külön-külön

  ## Security
  - RLS enabled minden táblán
  - Users csak saját statjaikat látják (kivéve public leaderboard)

  ## Features
  - Automatikus stat frissítés új meccs után
  - Rolling statistics (7d, 30d, 90d, all-time)
  - Break/hold tracking PvP játékokban
  - Nyomás alatti teljesítmény tracking
  - Drill-specifikus progress tracking
  - Checkout route analysis
  - Consistency metrics (std dev, CV)
*/

-- =====================================================
-- 1. DART_THROWS - Minden egyes dobás részletes eseménye
-- =====================================================

CREATE TABLE IF NOT EXISTS dart_throws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Játékos és játék kontextus
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  turn_id uuid REFERENCES game_turns(id) ON DELETE CASCADE,
  training_session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE,

  -- Játék típus és kontextus
  game_type text NOT NULL CHECK (game_type IN ('x01', 'cricket', 'around_the_clock', 'training')),
  game_variant text,

  -- Pozíció a játékban
  match_id uuid,
  set_number integer DEFAULT 1,
  leg_number integer DEFAULT 1,
  visit_number integer NOT NULL,
  dart_number integer NOT NULL CHECK (dart_number BETWEEN 1 AND 3),

  -- Dobás részletei
  sector integer CHECK (sector BETWEEN 0 AND 20 OR sector = 25),
  multiplier text NOT NULL CHECK (multiplier IN ('S', 'D', 'T', 'BULL', 'OUTER_BULL', 'MISS')),
  score integer NOT NULL CHECK (score >= 0 AND score <= 60),

  -- x01 specifikus
  remaining_before integer,
  remaining_after integer,
  is_bust boolean DEFAULT false,
  is_checkout_attempt boolean DEFAULT false,
  is_successful_checkout boolean DEFAULT false,

  -- Játék állapot
  is_starting_player boolean DEFAULT false,
  opponent_remaining integer,
  is_pressure_situation boolean DEFAULT false,

  -- Célzott vs. talált (opcionális, jövőbeli feature)
  intended_target text,

  -- Időbélyegek
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dart_throws_player ON dart_throws(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dart_throws_room ON dart_throws(room_id);
CREATE INDEX IF NOT EXISTS idx_dart_throws_turn ON dart_throws(turn_id);
CREATE INDEX IF NOT EXISTS idx_dart_throws_game_type ON dart_throws(game_type, player_id);
CREATE INDEX IF NOT EXISTS idx_dart_throws_training ON dart_throws(training_session_id);

ALTER TABLE dart_throws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dart throws"
  ON dart_throws FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Users can insert own dart throws"
  ON dart_throws FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid());

-- =====================================================
-- 2. LEG_STATISTICS - Leg szintű statisztikák
-- =====================================================

CREATE TABLE IF NOT EXISTS leg_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referenciák
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  match_id uuid,

  -- Pozíció
  set_number integer DEFAULT 1,
  leg_number integer DEFAULT 1,

  -- Játék info
  game_type text NOT NULL,
  starting_score integer,
  was_starting_player boolean DEFAULT false,
  won boolean DEFAULT false,

  -- Alapvető metrikák
  total_darts integer NOT NULL DEFAULT 0,
  total_score integer NOT NULL DEFAULT 0,
  total_visits integer NOT NULL DEFAULT 0,

  -- Átlagok
  three_dart_average numeric(6,2),
  first_9_average numeric(6,2),
  first_6_average numeric(6,2),
  first_3_average numeric(6,2),

  -- Visit breakdown
  visits_180 integer DEFAULT 0,
  visits_171_179 integer DEFAULT 0,
  visits_160_170 integer DEFAULT 0,
  visits_140_159 integer DEFAULT 0,
  visits_120_139 integer DEFAULT 0,
  visits_100_119 integer DEFAULT 0,
  visits_80_99 integer DEFAULT 0,
  visits_60_79 integer DEFAULT 0,
  visits_40_59 integer DEFAULT 0,
  visits_20_39 integer DEFAULT 0,
  visits_0_19 integer DEFAULT 0,
  visits_bust integer DEFAULT 0,

  highest_visit integer DEFAULT 0,
  longest_100plus_streak integer DEFAULT 0,

  -- Doubles/Triples
  doubles_hit integer DEFAULT 0,
  doubles_thrown integer DEFAULT 0,
  triples_hit integer DEFAULT 0,
  triples_thrown integer DEFAULT 0,

  -- Checkout
  checkout_score integer,
  checkout_darts integer,
  darts_at_double integer DEFAULT 0,

  -- Leg teljesítési idő
  duration_seconds integer,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leg_stats_player ON leg_statistics(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leg_stats_room ON leg_statistics(room_id);
CREATE INDEX IF NOT EXISTS idx_leg_stats_avg ON leg_statistics(three_dart_average DESC);

ALTER TABLE leg_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leg stats"
  ON leg_statistics FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Users can insert own leg stats"
  ON leg_statistics FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid());

-- =====================================================
-- 3. MATCH_STATISTICS - Meccs szintű statisztikák
-- =====================================================

CREATE TABLE IF NOT EXISTS match_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referenciák
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  opponent_id uuid REFERENCES auth.users(id),

  -- Játék info
  game_type text NOT NULL,
  game_mode text CHECK (game_mode IN ('bot', 'pvp', 'local')),
  starting_score integer,

  -- Eredmény
  won boolean DEFAULT false,
  sets_won integer DEFAULT 0,
  sets_lost integer DEFAULT 0,
  legs_won integer DEFAULT 0,
  legs_lost integer DEFAULT 0,

  -- Match átlagok
  match_average numeric(6,2),
  best_leg_average numeric(6,2),
  worst_leg_average numeric(6,2),

  -- Összesített visit stats
  total_180s integer DEFAULT 0,
  total_171_plus integer DEFAULT 0,
  total_160_plus integer DEFAULT 0,
  total_140_plus integer DEFAULT 0,
  total_100_plus integer DEFAULT 0,

  -- Doubles/Triples összesen
  total_doubles_hit integer DEFAULT 0,
  total_doubles_thrown integer DEFAULT 0,
  total_triples_hit integer DEFAULT 0,
  total_triples_thrown integer DEFAULT 0,

  -- Checkouts
  checkouts_hit integer DEFAULT 0,
  checkout_attempts integer DEFAULT 0,
  highest_checkout integer DEFAULT 0,

  -- Break/Hold (ha PvP)
  holds integer DEFAULT 0,
  breaks integer DEFAULT 0,

  -- Match időtartam
  duration_seconds integer,

  -- Sorozatok
  is_win_streak boolean DEFAULT false,
  streak_length integer DEFAULT 1,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_stats_player ON match_statistics(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_stats_opponent ON match_statistics(opponent_id);
CREATE INDEX IF NOT EXISTS idx_match_stats_won ON match_statistics(player_id, won);

ALTER TABLE match_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own match stats"
  ON match_statistics FOR SELECT
  TO authenticated
  USING (player_id = auth.uid() OR opponent_id = auth.uid());

CREATE POLICY "Users can insert own match stats"
  ON match_statistics FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid());

-- =====================================================
-- 4. PLAYER_STATISTICS_SUMMARY - Aggregált összesítők
-- =====================================================

CREATE TABLE IF NOT EXISTS player_statistics_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- ALL-TIME STATS
  -- ---------------

  -- Meccsek
  lifetime_matches_played integer DEFAULT 0,
  lifetime_matches_won integer DEFAULT 0,
  lifetime_win_percentage numeric(5,2) DEFAULT 0,

  -- Átlagok
  lifetime_average numeric(6,2) DEFAULT 0,
  lifetime_best_average numeric(6,2) DEFAULT 0,
  lifetime_median_average numeric(6,2) DEFAULT 0,

  -- Visit breakdown (all-time)
  lifetime_180s integer DEFAULT 0,
  lifetime_171_179 integer DEFAULT 0,
  lifetime_160_170 integer DEFAULT 0,
  lifetime_140_159 integer DEFAULT 0,
  lifetime_100_139 integer DEFAULT 0,

  -- Doubles all-time
  lifetime_doubles_hit integer DEFAULT 0,
  lifetime_doubles_thrown integer DEFAULT 0,
  lifetime_double_percentage numeric(5,2) DEFAULT 0,

  -- Triples all-time
  lifetime_triples_hit integer DEFAULT 0,
  lifetime_triples_thrown integer DEFAULT 0,
  lifetime_triple_percentage numeric(5,2) DEFAULT 0,

  -- Checkouts all-time
  lifetime_checkouts_hit integer DEFAULT 0,
  lifetime_checkout_attempts integer DEFAULT 0,
  lifetime_checkout_percentage numeric(5,2) DEFAULT 0,
  lifetime_highest_checkout integer DEFAULT 0,

  -- Leg stats
  lifetime_best_leg_darts integer,
  lifetime_total_legs_played integer DEFAULT 0,
  lifetime_legs_won integer DEFAULT 0,

  -- 90 DAY ROLLING STATS
  -- ---------------------
  rolling_90d_matches integer DEFAULT 0,
  rolling_90d_wins integer DEFAULT 0,
  rolling_90d_average numeric(6,2) DEFAULT 0,
  rolling_90d_checkout_pct numeric(5,2) DEFAULT 0,
  rolling_90d_double_pct numeric(5,2) DEFAULT 0,

  -- 30 DAY ROLLING STATS
  -- ---------------------
  rolling_30d_matches integer DEFAULT 0,
  rolling_30d_wins integer DEFAULT 0,
  rolling_30d_average numeric(6,2) DEFAULT 0,
  rolling_30d_checkout_pct numeric(5,2) DEFAULT 0,
  rolling_30d_double_pct numeric(5,2) DEFAULT 0,

  -- 7 DAY ROLLING STATS
  -- --------------------
  rolling_7d_matches integer DEFAULT 0,
  rolling_7d_wins integer DEFAULT 0,
  rolling_7d_average numeric(6,2) DEFAULT 0,
  rolling_7d_checkout_pct numeric(5,2) DEFAULT 0,
  rolling_7d_double_pct numeric(5,2) DEFAULT 0,

  -- CONSISTENCY METRICS
  -- -------------------
  average_std_deviation numeric(6,2),
  consistency_index numeric(5,2),

  -- STREAKS
  -- -------
  current_win_streak integer DEFAULT 0,
  longest_win_streak integer DEFAULT 0,
  current_loss_streak integer DEFAULT 0,

  -- RECORDS & MILESTONES
  -- --------------------
  total_180s_milestone integer DEFAULT 0,
  total_100plus_checkouts integer DEFAULT 0,

  last_calculated_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_stats_summary_player ON player_statistics_summary(player_id);

ALTER TABLE player_statistics_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stats summary"
  ON player_statistics_summary FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Users can insert own stats summary"
  ON player_statistics_summary FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "Users can update own stats summary"
  ON player_statistics_summary FOR UPDATE
  TO authenticated
  USING (player_id = auth.uid())
  WITH CHECK (player_id = auth.uid());

-- =====================================================
-- 5. CHECKOUT_ATTEMPTS - Részletes kiszálló tracker
-- =====================================================

CREATE TABLE IF NOT EXISTS checkout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referenciák
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid REFERENCES game_rooms(id) ON DELETE CASCADE,
  leg_stat_id uuid REFERENCES leg_statistics(id) ON DELETE CASCADE,

  -- Checkout részletek
  checkout_value integer NOT NULL CHECK (checkout_value BETWEEN 2 AND 170),
  was_successful boolean DEFAULT false,
  darts_used integer CHECK (darts_used BETWEEN 1 AND 3),

  -- Doubles info
  target_double text,
  doubles_hit integer DEFAULT 0,
  doubles_missed integer DEFAULT 0,

  -- Kontextus
  is_match_winning boolean DEFAULT false,
  is_leg_winning boolean DEFAULT false,
  is_set_winning boolean DEFAULT false,
  opponent_remaining integer,
  is_under_pressure boolean DEFAULT false,

  -- Route (pl. T20-D20, T19-D16)
  checkout_route text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_attempts_player ON checkout_attempts(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_attempts_value ON checkout_attempts(checkout_value);
CREATE INDEX IF NOT EXISTS idx_checkout_attempts_success ON checkout_attempts(player_id, was_successful);

ALTER TABLE checkout_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkout attempts"
  ON checkout_attempts FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Users can insert own checkout attempts"
  ON checkout_attempts FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid());

-- =====================================================
-- 6. TRAINING_DRILL_STATISTICS - Gyakorló módok
-- =====================================================

CREATE TABLE IF NOT EXISTS training_drill_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referenciák
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drill_id uuid REFERENCES drills(id) ON DELETE CASCADE,
  training_session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE,

  -- Drill info
  drill_type text NOT NULL,
  drill_config jsonb,

  -- Teljesítmény
  score integer,
  accuracy_percentage numeric(5,2),
  completion_time_seconds integer,

  -- Drill-specifikus metrikák
  doubles_hit integer DEFAULT 0,
  doubles_attempted integer DEFAULT 0,
  triples_hit integer DEFAULT 0,
  triples_attempted integer DEFAULT 0,
  bulls_hit integer DEFAULT 0,
  bulls_attempted integer DEFAULT 0,

  -- Progress
  is_personal_best boolean DEFAULT false,
  improvement_from_last numeric(5,2),

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_drill_stats_player ON training_drill_statistics(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_drill_stats_drill ON training_drill_statistics(drill_id, player_id);

ALTER TABLE training_drill_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own training stats"
  ON training_drill_statistics FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Users can insert own training stats"
  ON training_drill_statistics FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid());

-- =====================================================
-- 7. DOUBLE_STATISTICS - Részletes dupla statisztikák
-- =====================================================

CREATE TABLE IF NOT EXISTS double_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Duplánként lebontva
  double_number integer NOT NULL CHECK (double_number BETWEEN 1 AND 20 OR double_number = 25),

  -- Stat breakdown
  hits integer DEFAULT 0,
  attempts integer DEFAULT 0,
  hit_percentage numeric(5,2) DEFAULT 0,

  -- Időszakok
  all_time_hits integer DEFAULT 0,
  all_time_attempts integer DEFAULT 0,
  last_30d_hits integer DEFAULT 0,
  last_30d_attempts integer DEFAULT 0,

  -- Preferenciák
  is_preferred_double boolean DEFAULT false,
  is_bogey_double boolean DEFAULT false,

  updated_at timestamptz DEFAULT now(),

  UNIQUE(player_id, double_number)
);

CREATE INDEX IF NOT EXISTS idx_double_stats_player ON double_statistics(player_id, hit_percentage DESC);

ALTER TABLE double_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own double stats"
  ON double_statistics FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE POLICY "Users can upsert own double stats"
  ON double_statistics FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "Users can update own double stats"
  ON double_statistics FOR UPDATE
  TO authenticated
  USING (player_id = auth.uid())
  WITH CHECK (player_id = auth.uid());

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Initialize player statistics summary
CREATE OR REPLACE FUNCTION initialize_player_stats_summary(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO player_statistics_summary (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;
END;
$$;

-- Function: Update player statistics (called after each match)
CREATE OR REPLACE FUNCTION update_player_statistics_summary(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Calculate and update all-time stats
  UPDATE player_statistics_summary
  SET
    lifetime_matches_played = (
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id
    ),
    lifetime_matches_won = (
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND won = true
    ),
    lifetime_average = (
      SELECT AVG(three_dart_average) FROM leg_statistics WHERE player_id = p_player_id
    ),
    lifetime_best_average = (
      SELECT MAX(three_dart_average) FROM leg_statistics WHERE player_id = p_player_id
    ),
    lifetime_180s = (
      SELECT SUM(visits_180) FROM leg_statistics WHERE player_id = p_player_id
    ),
    lifetime_checkouts_hit = (
      SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id AND was_successful = true
    ),
    lifetime_checkout_attempts = (
      SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id
    ),
    lifetime_highest_checkout = (
      SELECT MAX(checkout_value) FROM checkout_attempts WHERE player_id = p_player_id AND was_successful = true
    ),

    -- 30 day rolling
    rolling_30d_matches = (
      SELECT COUNT(*) FROM match_statistics
      WHERE player_id = p_player_id AND created_at > NOW() - INTERVAL '30 days'
    ),
    rolling_30d_wins = (
      SELECT COUNT(*) FROM match_statistics
      WHERE player_id = p_player_id AND won = true AND created_at > NOW() - INTERVAL '30 days'
    ),
    rolling_30d_average = (
      SELECT AVG(three_dart_average) FROM leg_statistics
      WHERE player_id = p_player_id AND created_at > NOW() - INTERVAL '30 days'
    ),

    last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE player_id = p_player_id;

  -- Calculate win percentage
  UPDATE player_statistics_summary
  SET lifetime_win_percentage =
    CASE
      WHEN lifetime_matches_played > 0
      THEN (lifetime_matches_won::numeric / lifetime_matches_played::numeric * 100)
      ELSE 0
    END,
    lifetime_checkout_percentage =
    CASE
      WHEN lifetime_checkout_attempts > 0
      THEN (lifetime_checkouts_hit::numeric / lifetime_checkout_attempts::numeric * 100)
      ELSE 0
    END
  WHERE player_id = p_player_id;
END;
$$;

-- Trigger: Auto-initialize stats summary on profile creation
CREATE OR REPLACE FUNCTION auto_initialize_stats_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO player_statistics_summary (player_id)
  VALUES (NEW.id)
  ON CONFLICT (player_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_initialize_stats ON user_profile;
CREATE TRIGGER trigger_auto_initialize_stats
  AFTER INSERT ON user_profile
  FOR EACH ROW
  EXECUTE FUNCTION auto_initialize_stats_summary();
