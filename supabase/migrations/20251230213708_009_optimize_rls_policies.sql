/*
  # Optimize RLS Policies for Performance
  
  1. Changes
    - Replace auth.uid() with (select auth.uid()) in all policies
    - This prevents re-evaluation for each row and improves query performance
    
  2. Security
    - No changes to security logic, only performance optimization
    - All existing access controls remain the same
*/

-- user_profile policies
DROP POLICY IF EXISTS "Users can update own profile" ON user_profile;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profile;

CREATE POLICY "Users can update own profile"
  ON user_profile FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON user_profile FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- user_metrics_daily policies
DROP POLICY IF EXISTS "Users can view own metrics" ON user_metrics_daily;
DROP POLICY IF EXISTS "Users can insert own metrics" ON user_metrics_daily;
DROP POLICY IF EXISTS "Users can update own metrics" ON user_metrics_daily;

CREATE POLICY "Users can view own metrics"
  ON user_metrics_daily FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own metrics"
  ON user_metrics_daily FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own metrics"
  ON user_metrics_daily FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- training_sessions policies
DROP POLICY IF EXISTS "Users can view own training sessions" ON training_sessions;
DROP POLICY IF EXISTS "Users can insert own training sessions" ON training_sessions;
DROP POLICY IF EXISTS "Users can update own training sessions" ON training_sessions;

CREATE POLICY "Users can view own training sessions"
  ON training_sessions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own training sessions"
  ON training_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own training sessions"
  ON training_sessions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- training_session_events policies
DROP POLICY IF EXISTS "Users can view own session events" ON training_session_events;
DROP POLICY IF EXISTS "Users can insert own session events" ON training_session_events;

CREATE POLICY "Users can view own session events"
  ON training_session_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM training_sessions
      WHERE training_sessions.id = training_session_events.session_id
      AND training_sessions.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own session events"
  ON training_session_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_sessions
      WHERE training_sessions.id = training_session_events.session_id
      AND training_sessions.user_id = (select auth.uid())
    )
  );

-- audit_log policies
DROP POLICY IF EXISTS "Users can view own audit entries" ON audit_log;

CREATE POLICY "Users can view own audit entries"
  ON audit_log FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- notifications policies
DROP POLICY IF EXISTS "Admins can manage notifications" ON notifications;

CREATE POLICY "Admins can manage notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profile
      WHERE user_profile.id = (select auth.uid())
      AND user_profile.is_admin = true
    )
  );

-- notification_targets policies
DROP POLICY IF EXISTS "Users can view own notification targets" ON notification_targets;
DROP POLICY IF EXISTS "Users can update own notification targets" ON notification_targets;

CREATE POLICY "Users can view own notification targets"
  ON notification_targets FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update own notification targets"
  ON notification_targets FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- notification_receipts policies
DROP POLICY IF EXISTS "Users can view own receipts" ON notification_receipts;
DROP POLICY IF EXISTS "Users can update own receipts" ON notification_receipts;

CREATE POLICY "Users can view own receipts"
  ON notification_receipts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update own receipts"
  ON notification_receipts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- media_assets policies
DROP POLICY IF EXISTS "Admins can insert media" ON media_assets;

CREATE POLICY "Admins can insert media"
  ON media_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profile
      WHERE user_profile.id = (select auth.uid())
      AND user_profile.is_admin = true
    )
  );

-- game_rooms policies
DROP POLICY IF EXISTS "Users can view their rooms" ON game_rooms;
DROP POLICY IF EXISTS "Users can create game rooms" ON game_rooms;
DROP POLICY IF EXISTS "Users can update their rooms" ON game_rooms;

CREATE POLICY "Users can view their rooms"
  ON game_rooms FOR SELECT
  TO authenticated
  USING (
    created_by = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.room_id = game_rooms.id
      AND game_players.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create game rooms"
  ON game_rooms FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Users can update their rooms"
  ON game_rooms FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM game_players
      WHERE game_players.room_id = game_rooms.id
      AND game_players.user_id = (select auth.uid())
    )
  );

-- game_players policies
DROP POLICY IF EXISTS "Users can insert players" ON game_players;
DROP POLICY IF EXISTS "Users can update their player record" ON game_players;

CREATE POLICY "Users can insert players"
  ON game_players FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE game_rooms.id = game_players.room_id
      AND game_rooms.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Users can update their player record"
  ON game_players FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE game_rooms.id = game_players.room_id
      AND game_rooms.created_by = (select auth.uid())
    )
  );

-- game_state policies
DROP POLICY IF EXISTS "Users can insert game state" ON game_state;
DROP POLICY IF EXISTS "Users can update game state" ON game_state;

CREATE POLICY "Users can insert game state"
  ON game_state FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE game_rooms.id = game_state.room_id
      AND game_rooms.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Users can update game state"
  ON game_state FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_rooms
      WHERE game_rooms.id = game_state.room_id
      AND (
        game_rooms.created_by = (select auth.uid()) OR
        EXISTS (
          SELECT 1 FROM game_players
          WHERE game_players.room_id = game_rooms.id
          AND game_players.user_id = (select auth.uid())
        )
      )
    )
  );

-- game_invites policies
DROP POLICY IF EXISTS "Users can view their invites" ON game_invites;
DROP POLICY IF EXISTS "Users can create invites" ON game_invites;
DROP POLICY IF EXISTS "Invitees can update invites" ON game_invites;

CREATE POLICY "Users can view their invites"
  ON game_invites FOR SELECT
  TO authenticated
  USING (inviter_id = (select auth.uid()) OR invitee_id = (select auth.uid()));

CREATE POLICY "Users can create invites"
  ON game_invites FOR INSERT
  TO authenticated
  WITH CHECK (inviter_id = (select auth.uid()));

CREATE POLICY "Invitees can update invites"
  ON game_invites FOR UPDATE
  TO authenticated
  USING (invitee_id = (select auth.uid()))
  WITH CHECK (invitee_id = (select auth.uid()));

-- clubs policies
DROP POLICY IF EXISTS "Owner can update club" ON clubs;
DROP POLICY IF EXISTS "Authenticated users can create clubs" ON clubs;

CREATE POLICY "Owner can update club"
  ON clubs FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Authenticated users can create clubs"
  ON clubs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

-- club_members policies
DROP POLICY IF EXISTS "Users can join clubs" ON club_members;
DROP POLICY IF EXISTS "Officers can update members" ON club_members;
DROP POLICY IF EXISTS "Users can leave clubs" ON club_members;

CREATE POLICY "Users can join clubs"
  ON club_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Officers can update members"
  ON club_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = club_members.club_id
      AND cm.user_id = (select auth.uid())
      AND cm.role IN ('owner', 'officer')
    )
  );

CREATE POLICY "Users can leave clubs"
  ON club_members FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- club_invites policies
DROP POLICY IF EXISTS "Users can view their club invites" ON club_invites;
DROP POLICY IF EXISTS "Members can create invites" ON club_invites;
DROP POLICY IF EXISTS "Invitees can update invites" ON club_invites;

CREATE POLICY "Users can view their club invites"
  ON club_invites FOR SELECT
  TO authenticated
  USING (inviter_id = (select auth.uid()) OR invitee_id = (select auth.uid()));

CREATE POLICY "Members can create invites"
  ON club_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_invites.club_id
      AND club_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Invitees can update invites"
  ON club_invites FOR UPDATE
  TO authenticated
  USING (invitee_id = (select auth.uid()))
  WITH CHECK (invitee_id = (select auth.uid()));

-- club_feed_posts policies
DROP POLICY IF EXISTS "Members can view feed" ON club_feed_posts;
DROP POLICY IF EXISTS "Members can post" ON club_feed_posts;

CREATE POLICY "Members can view feed"
  ON club_feed_posts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_feed_posts.club_id
      AND club_members.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Members can post"
  ON club_feed_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_feed_posts.club_id
      AND club_members.user_id = (select auth.uid())
    )
  );

-- tournaments policies
DROP POLICY IF EXISTS "Host can create tournaments" ON tournaments;
DROP POLICY IF EXISTS "Host can update tournaments" ON tournaments;

CREATE POLICY "Host can create tournaments"
  ON tournaments FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Host can update tournaments"
  ON tournaments FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

-- tournament_entries policies
DROP POLICY IF EXISTS "Users can register" ON tournament_entries;
DROP POLICY IF EXISTS "Users can update own entry" ON tournament_entries;

CREATE POLICY "Users can register"
  ON tournament_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own entry"
  ON tournament_entries FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- referral_codes policies
DROP POLICY IF EXISTS "Users can view own referral code" ON referral_codes;
DROP POLICY IF EXISTS "Users can create own referral code" ON referral_codes;
DROP POLICY IF EXISTS "Users can update own referral code" ON referral_codes;

CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create own referral code"
  ON referral_codes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own referral code"
  ON referral_codes FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- referral_events policies
DROP POLICY IF EXISTS "Users can view their referral events" ON referral_events;

CREATE POLICY "Users can view their referral events"
  ON referral_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM referral_codes
      WHERE referral_codes.id = referral_events.referral_code_id
      AND referral_codes.user_id = (select auth.uid())
    ) OR
    referred_id = (select auth.uid())
  );

-- subscription_state policies
DROP POLICY IF EXISTS "Users can view own subscription" ON subscription_state;
DROP POLICY IF EXISTS "Users can insert own subscription" ON subscription_state;
DROP POLICY IF EXISTS "Users can update own subscription" ON subscription_state;

CREATE POLICY "Users can view own subscription"
  ON subscription_state FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own subscription"
  ON subscription_state FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own subscription"
  ON subscription_state FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- referral_rewards_ledger policies
DROP POLICY IF EXISTS "Users can view own rewards" ON referral_rewards_ledger;

CREATE POLICY "Users can view own rewards"
  ON referral_rewards_ledger FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- token_accounts policies
DROP POLICY IF EXISTS "Users can view own token account" ON token_accounts;

CREATE POLICY "Users can view own token account"
  ON token_accounts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- token_ledger policies
DROP POLICY IF EXISTS "Users can view own ledger" ON token_ledger;

CREATE POLICY "Users can view own ledger"
  ON token_ledger FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));
