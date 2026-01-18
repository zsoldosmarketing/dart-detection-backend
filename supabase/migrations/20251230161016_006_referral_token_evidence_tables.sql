/*
  # Referral, Token Economy, and Evidence Tables
  
  ## Tables Created
  - referral_codes - User referral codes
  - referral_events - Referral tracking
  - subscription_state - User subscription status
  - referral_rewards_ledger - Free months tracking
  - token_accounts - User token balances (scaffold)
  - token_ledger - Transaction history (scaffold)
  - turn_evidence - Camera evidence (scaffold)
  
  ## Security
  - RLS enabled on all tables
*/

CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  code text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  total_referrals integer DEFAULT 0,
  total_conversions integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_active = true);

CREATE POLICY "Users can create own referral code"
  ON referral_codes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own referral code"
  ON referral_codes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code_id uuid NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  status text DEFAULT 'registered' CHECK (status IN ('registered', 'converted', 'rewarded')),
  converted_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their referral events"
  ON referral_events FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "System can insert referral events"
  ON referral_events FOR INSERT
  TO authenticated
  WITH CHECK (referred_id = auth.uid());

CREATE TABLE IF NOT EXISTS subscription_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  status text DEFAULT 'free' CHECK (status IN ('free', 'trial', 'active', 'cancelled', 'expired')),
  plan text DEFAULT 'free',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  referral_discount_percent integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscription_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON subscription_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON subscription_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS referral_rewards_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('free_month', 'discount', 'bonus_tokens')),
  amount integer NOT NULL,
  source_event_id uuid REFERENCES referral_events(id),
  applied_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE referral_rewards_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rewards"
  ON referral_rewards_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS token_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance integer DEFAULT 0,
  lifetime_earned integer DEFAULT 0,
  lifetime_spent integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE token_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own token account"
  ON token_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS token_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'entry_fee', 'prize', 'platform_fee', 'burn', 'refund', 'bonus')),
  reference_type text,
  reference_id uuid,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE token_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ledger"
  ON token_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS turn_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id uuid NOT NULL REFERENCES game_turns(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id uuid REFERENCES game_players(id),
  image_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'disputed', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  dispute_reason text,
  corrected_score integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE turn_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence in their games"
  ON turn_evidence FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events(referrer_id);
CREATE INDEX IF NOT EXISTS idx_subscription_state_user ON subscription_state(user_id);
CREATE INDEX IF NOT EXISTS idx_token_ledger_user ON token_ledger(user_id);