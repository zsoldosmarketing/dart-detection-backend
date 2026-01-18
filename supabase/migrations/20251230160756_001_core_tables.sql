/*
  # DartsTraining Platform - Core Tables
  
  ## Overview
  Creates the foundational tables for user management, training, and configuration.
  
  ## Tables Created
  - user_profile - Extended user profiles
  - password_reset_tokens - Password reset flow
  - drills - Training drill definitions
  - programs - Multi-day training programs
  - challenges - Achievement challenges
  - training_sessions - User training records
  - training_session_events - Individual training events
  - user_metrics_daily - Daily performance aggregates
  - app_config - Dynamic configuration
  - audit_log - Action logging
  
  ## Security
  - RLS enabled on all tables
  - Policies restrict access based on authentication
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_profile (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  skill_rating numeric DEFAULT 5.0,
  preferred_doubles jsonb DEFAULT '["D20", "D16", "D8"]'::jsonb,
  theme text DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
  locale text DEFAULT 'hu',
  auto_update boolean DEFAULT false,
  email_notifications boolean DEFAULT false,
  push_notifications boolean DEFAULT true,
  is_admin boolean DEFAULT false,
  total_games_played integer DEFAULT 0,
  total_wins integer DEFAULT 0,
  total_checkouts integer DEFAULT 0,
  highest_checkout integer DEFAULT 0,
  average_score numeric DEFAULT 0,
  best_average numeric DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view any profile"
  ON user_profile FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profile FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profile FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('doubles', 'triples', 'sectors', 'bull', 'checkout', 'setup', 'general', 'pressure')),
  name_key text NOT NULL,
  desc_key text NOT NULL,
  config jsonb NOT NULL,
  difficulty integer DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  estimated_minutes integer DEFAULT 10,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active drills"
  ON drills FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TABLE IF NOT EXISTS programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key text NOT NULL,
  desc_key text NOT NULL,
  config jsonb NOT NULL,
  duration_days integer NOT NULL,
  daily_minutes integer DEFAULT 15,
  difficulty integer DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  target_skill text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active programs"
  ON programs FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key text NOT NULL,
  desc_key text NOT NULL,
  rule jsonb NOT NULL,
  reward jsonb NOT NULL,
  is_active boolean DEFAULT true,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active challenges"
  ON challenges FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TABLE IF NOT EXISTS training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drill_id uuid REFERENCES drills(id),
  program_id uuid REFERENCES programs(id),
  program_day integer,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  score numeric,
  metrics jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own training sessions"
  ON training_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training sessions"
  ON training_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training sessions"
  ON training_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS training_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  dart_index integer,
  target text,
  hit text,
  score integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE training_session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session events"
  ON training_session_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM training_sessions
      WHERE training_sessions.id = training_session_events.session_id
      AND training_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session events"
  ON training_session_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_sessions
      WHERE training_sessions.id = training_session_events.session_id
      AND training_sessions.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS user_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_darts integer DEFAULT 0,
  total_score integer DEFAULT 0,
  doubles_attempted integer DEFAULT 0,
  doubles_hit integer DEFAULT 0,
  triples_attempted integer DEFAULT 0,
  triples_hit integer DEFAULT 0,
  bulls_attempted integer DEFAULT 0,
  bulls_hit integer DEFAULT 0,
  checkouts_attempted integer DEFAULT 0,
  checkouts_hit integer DEFAULT 0,
  highest_checkout integer DEFAULT 0,
  training_minutes integer DEFAULT 0,
  games_played integer DEFAULT 0,
  games_won integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE user_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics"
  ON user_metrics_daily FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metrics"
  ON user_metrics_daily FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metrics"
  ON user_metrics_daily FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value_json jsonb NOT NULL,
  type text NOT NULL CHECK (type IN ('boolean', 'number', 'string', 'json')),
  description_key text,
  updated_by_user_id uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read config"
  ON app_config FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit entries"
  ON audit_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_profile WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "Anyone can insert audit log"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_profile_username ON user_profile(username);
CREATE INDEX IF NOT EXISTS idx_user_profile_skill ON user_profile(skill_rating);
CREATE INDEX IF NOT EXISTS idx_training_sessions_user ON training_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_drill ON training_sessions(drill_id);
CREATE INDEX IF NOT EXISTS idx_user_metrics_daily_user_date ON user_metrics_daily(user_id, date);
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config(key);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

INSERT INTO app_config (key, value_json, type, description_key) VALUES
  ('STRIPE_ENABLED', 'false', 'boolean', 'config.stripe_enabled'),
  ('TOKEN_ECONOMY_ENABLED', 'false', 'boolean', 'config.token_economy_enabled'),
  ('CAMERA_EVIDENCE_ENABLED', 'false', 'boolean', 'config.camera_evidence_enabled'),
  ('BACKGROUND_PUSH_ENABLED', 'false', 'boolean', 'config.background_push_enabled'),
  ('EMAIL_NUDGE_ENABLED', 'false', 'boolean', 'config.email_nudge_enabled'),
  ('LEADERBOARDS_ENABLED', 'true', 'boolean', 'config.leaderboards_enabled'),
  ('DISPUTE_SYSTEM_ENABLED', 'false', 'boolean', 'config.dispute_system_enabled'),
  ('DEFAULT_X01_SCORE', '501', 'number', 'config.default_x01_score'),
  ('ALLOWED_X01_SCORES', '[301, 501, 701]', 'json', 'config.allowed_x01_scores'),
  ('UNDO_LIMIT_PER_LEG', '3', 'number', 'config.undo_limit_per_leg'),
  ('UNDO_REQUIRES_CONFIRMATION', 'true', 'boolean', 'config.undo_requires_confirmation'),
  ('RECONNECT_GRACE_SECONDS', '60', 'number', 'config.reconnect_grace_seconds'),
  ('FORFEIT_AFTER_INACTIVE_SECONDS', '300', 'number', 'config.forfeit_after_inactive_seconds'),
  ('MIN_TOURNAMENT_HOST_SKILL', '6', 'number', 'config.min_tournament_host_skill'),
  ('TOURNAMENT_MIN_PLAYERS', '4', 'number', 'config.tournament_min_players'),
  ('TOURNAMENT_MAX_PLAYERS', '32', 'number', 'config.tournament_max_players'),
  ('TOURNAMENT_INVITE_TIMEOUT_SECONDS', '600', 'number', 'config.tournament_invite_timeout_seconds'),
  ('INACTIVITY_NUDGE_DAYS', '2', 'number', 'config.inactivity_nudge_days'),
  ('STREAK_NUDGE_MILESTONES', '[3, 7, 14, 30]', 'json', 'config.streak_nudge_milestones'),
  ('WEAK_DOUBLES_THRESHOLD', '0.18', 'number', 'config.weak_doubles_threshold'),
  ('WEAK_CHECKOUT_THRESHOLD', '0.12', 'number', 'config.weak_checkout_threshold'),
  ('NUDGE_COOLDOWN_HOURS', '24', 'number', 'config.nudge_cooldown_hours'),
  ('MAX_INVITES_PER_HOUR', '20', 'number', 'config.max_invites_per_hour'),
  ('MAX_ADMIN_PUSH_PER_DAY', '50', 'number', 'config.max_admin_push_per_day'),
  ('MAX_IMAGE_UPLOAD_MB', '5', 'number', 'config.max_image_upload_mb'),
  ('MAX_NOTIF_BODY_LENGTH', '180', 'number', 'config.max_notif_body_length'),
  ('PLATFORM_FEE_PERCENT', '10', 'number', 'config.platform_fee_percent'),
  ('MIN_ENTRY_FEE_TOKENS', '10', 'number', 'config.min_entry_fee_tokens'),
  ('MAX_ENTRY_FEE_TOKENS', '1000', 'number', 'config.max_entry_fee_tokens')
ON CONFLICT (key) DO NOTHING;