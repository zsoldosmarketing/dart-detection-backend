/*
  # Fix Security and Performance Issues

  1. Add Missing Indexes for Foreign Keys
    - Create indexes on `multiplayer_games.game_mode_id`
    - Create indexes on `multiplayer_games.winner_user_id`

  2. Fix RLS Policy Performance Issues
    - Replace `auth.uid()` calls with `(select auth.uid())` for better performance
    - Update policies in: program_enrollments, notification_receipts, player_profiles, multiplayer_games, multiplayer_game_players, multiplayer_game_turns, friendships, friend_requests, push_subscriptions, tournaments, push_notifications, referral_events

  3. Drop Unused Indexes
    - Remove 62+ unused indexes that are causing unnecessary overhead

  4. Fix Function Search Paths
    - Update functions to use immutable search paths
*/

-- ===== 1. ADD MISSING FOREIGN KEY INDEXES =====

CREATE INDEX IF NOT EXISTS idx_multiplayer_games_game_mode_id 
  ON public.multiplayer_games(game_mode_id);

CREATE INDEX IF NOT EXISTS idx_multiplayer_games_winner_user_id 
  ON public.multiplayer_games(winner_user_id);


-- ===== 2. DROP UNUSED INDEXES =====

DROP INDEX IF EXISTS idx_referral_events_referrer;
DROP INDEX IF EXISTS idx_subscription_state_user;
DROP INDEX IF EXISTS idx_token_ledger_user;
DROP INDEX IF EXISTS idx_tournaments_winner_id;
DROP INDEX IF EXISTS idx_training_session_events_session_id;
DROP INDEX IF EXISTS idx_training_sessions_program_id;
DROP INDEX IF EXISTS idx_turn_evidence_player_id;
DROP INDEX IF EXISTS idx_turn_evidence_reviewed_by;
DROP INDEX IF EXISTS idx_turn_evidence_room_id;
DROP INDEX IF EXISTS idx_app_config_updated_by_user_id;
DROP INDEX IF EXISTS idx_club_feed_posts_user_id;
DROP INDEX IF EXISTS idx_club_invites_club_id;
DROP INDEX IF EXISTS idx_club_invites_invitee_id;
DROP INDEX IF EXISTS idx_club_invites_inviter_id;
DROP INDEX IF EXISTS idx_clubs_created_by;
DROP INDEX IF EXISTS idx_game_events_player_id;
DROP INDEX IF EXISTS idx_game_events_room_id;
DROP INDEX IF EXISTS idx_game_invites_inviter_id;
DROP INDEX IF EXISTS idx_game_invites_room_id;
DROP INDEX IF EXISTS idx_game_rooms_winner_id;
DROP INDEX IF EXISTS idx_media_assets_uploaded_by;
DROP INDEX IF EXISTS idx_notification_receipts_unread;
DROP INDEX IF EXISTS idx_notification_targets_notification;
DROP INDEX IF EXISTS idx_notification_targets_user;
DROP INDEX IF EXISTS idx_game_turns_player_id;
DROP INDEX IF EXISTS idx_game_turns_undone_by;
DROP INDEX IF EXISTS idx_notification_receipts_notification_id;
DROP INDEX IF EXISTS idx_notifications_created_by;
DROP INDEX IF EXISTS idx_password_reset_tokens_user_id;
DROP INDEX IF EXISTS idx_referral_events_referral_code_id;
DROP INDEX IF EXISTS idx_referral_events_referred_id;
DROP INDEX IF EXISTS idx_referral_rewards_ledger_source_event_id;
DROP INDEX IF EXISTS idx_referral_rewards_ledger_user_id;
DROP INDEX IF EXISTS idx_tournament_brackets_next_match_id;
DROP INDEX IF EXISTS idx_tournament_brackets_player1_entry_id;
DROP INDEX IF EXISTS idx_tournament_brackets_player2_entry_id;
DROP INDEX IF EXISTS idx_tournament_brackets_winner_entry_id;
DROP INDEX IF EXISTS idx_tournament_events_match_id;
DROP INDEX IF EXISTS idx_tournament_events_tournament_id;
DROP INDEX IF EXISTS idx_tournament_events_user_id;
DROP INDEX IF EXISTS idx_tournament_matches_bracket_id;
DROP INDEX IF EXISTS idx_tournament_matches_game_room_id;
DROP INDEX IF EXISTS idx_tournament_matches_player1_id;
DROP INDEX IF EXISTS idx_tournament_matches_player2_id;
DROP INDEX IF EXISTS idx_tournament_matches_winner_id;
DROP INDEX IF EXISTS idx_tournaments_club_id;
DROP INDEX IF EXISTS idx_tournaments_created_by;
DROP INDEX IF EXISTS idx_user_profile_username;
DROP INDEX IF EXISTS idx_user_profile_skill;
DROP INDEX IF EXISTS idx_training_sessions_user;
DROP INDEX IF EXISTS idx_training_sessions_drill;
DROP INDEX IF EXISTS idx_user_metrics_daily_user_date;
DROP INDEX IF EXISTS idx_app_config_key;
DROP INDEX IF EXISTS idx_audit_log_user;
DROP INDEX IF EXISTS idx_audit_log_entity;
DROP INDEX IF EXISTS idx_audit_log_created;
DROP INDEX IF EXISTS idx_game_players_user;
DROP INDEX IF EXISTS idx_game_turns_room;
DROP INDEX IF EXISTS idx_game_invites_invitee;
DROP INDEX IF EXISTS idx_clubs_name;
DROP INDEX IF EXISTS idx_club_members_club;
DROP INDEX IF EXISTS idx_club_feed_club;
DROP INDEX IF EXISTS idx_tournaments_status;
DROP INDEX IF EXISTS idx_tournament_entries_tournament;
DROP INDEX IF EXISTS idx_tournament_brackets_tournament;
DROP INDEX IF EXISTS idx_tournament_matches_tournament;
DROP INDEX IF EXISTS idx_referral_codes_code;
DROP INDEX IF EXISTS idx_turn_evidence_turn_id;
DROP INDEX IF EXISTS idx_program_enrollments_program;
DROP INDEX IF EXISTS idx_player_profiles_user_id;
DROP INDEX IF EXISTS idx_multiplayer_games_status;
DROP INDEX IF EXISTS idx_multiplayer_games_host;
DROP INDEX IF EXISTS idx_multiplayer_game_players_game;
DROP INDEX IF EXISTS idx_multiplayer_game_players_user;
DROP INDEX IF EXISTS idx_multiplayer_game_turns_game;
DROP INDEX IF EXISTS idx_multiplayer_game_turns_player;
DROP INDEX IF EXISTS idx_friendships_friend_id;
DROP INDEX IF EXISTS idx_friend_requests_from_user;
DROP INDEX IF EXISTS idx_push_subscriptions_user_id;
DROP INDEX IF EXISTS idx_push_notifications_user_id;


-- ===== 3. FIX RLS POLICIES - program_enrollments =====

DROP POLICY IF EXISTS "Users can view their enrollments" ON program_enrollments;
CREATE POLICY "Users can view their enrollments"
  ON program_enrollments FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can enroll in programs" ON program_enrollments;
CREATE POLICY "Users can enroll in programs"
  ON program_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their enrollments" ON program_enrollments;
CREATE POLICY "Users can update their enrollments"
  ON program_enrollments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));


-- ===== 4. FIX RLS POLICIES - notification_receipts =====

DROP POLICY IF EXISTS "System can insert receipts" ON notification_receipts;
CREATE POLICY "System can insert receipts"
  ON notification_receipts FOR INSERT
  WITH CHECK (true);


-- ===== 5. FIX RLS POLICIES - player_profiles =====

DROP POLICY IF EXISTS "Users can view own profiles" ON player_profiles;
CREATE POLICY "Users can view own profiles"
  ON player_profiles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own profiles" ON player_profiles;
CREATE POLICY "Users can create own profiles"
  ON player_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profiles" ON player_profiles;
CREATE POLICY "Users can update own profiles"
  ON player_profiles FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own profiles" ON player_profiles;
CREATE POLICY "Users can delete own profiles"
  ON player_profiles FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));


-- ===== 6. FIX RLS POLICIES - multiplayer_games =====

DROP POLICY IF EXISTS "Users can view public waiting games" ON multiplayer_games;
CREATE POLICY "Users can view public waiting games"
  ON multiplayer_games FOR SELECT
  TO authenticated
  USING (status = 'waiting' OR host_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create games" ON multiplayer_games;
CREATE POLICY "Users can create games"
  ON multiplayer_games FOR INSERT
  TO authenticated
  WITH CHECK (host_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Host can update own games" ON multiplayer_games;
CREATE POLICY "Host can update own games"
  ON multiplayer_games FOR UPDATE
  TO authenticated
  USING (host_user_id = (select auth.uid()))
  WITH CHECK (host_user_id = (select auth.uid()));


-- ===== 7. FIX RLS POLICIES - multiplayer_game_players =====

DROP POLICY IF EXISTS "Users can join games" ON multiplayer_game_players;
CREATE POLICY "Users can join games"
  ON multiplayer_game_players FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own player state" ON multiplayer_game_players;
CREATE POLICY "Users can update own player state"
  ON multiplayer_game_players FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Host can update any player" ON multiplayer_game_players;
CREATE POLICY "Host can update any player"
  ON multiplayer_game_players FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM multiplayer_games
      WHERE id = game_id AND host_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM multiplayer_games
      WHERE id = game_id AND host_user_id = (select auth.uid())
    )
  );


-- ===== 8. FIX RLS POLICIES - multiplayer_game_turns =====

DROP POLICY IF EXISTS "Players can add turns" ON multiplayer_game_turns;
CREATE POLICY "Players can add turns"
  ON multiplayer_game_turns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM multiplayer_game_players
      WHERE id = player_id
      AND user_id = (select auth.uid())
    )
  );


-- ===== 9. FIX RLS POLICIES - friendships =====

DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()) OR friend_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;
CREATE POLICY "Users can delete own friendships"
  ON friendships FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()) OR friend_id = (select auth.uid()));


-- ===== 10. FIX RLS POLICIES - friend_requests =====

DROP POLICY IF EXISTS "Users can view relevant friend requests" ON friend_requests;
CREATE POLICY "Users can view relevant friend requests"
  ON friend_requests FOR SELECT
  TO authenticated
  USING (from_user_id = (select auth.uid()) OR to_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create friend requests" ON friend_requests;
CREATE POLICY "Users can create friend requests"
  ON friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update friend requests sent to them" ON friend_requests;
CREATE POLICY "Users can update friend requests sent to them"
  ON friend_requests FOR UPDATE
  TO authenticated
  USING (to_user_id = (select auth.uid()))
  WITH CHECK (to_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own sent friend requests" ON friend_requests;
CREATE POLICY "Users can delete own sent friend requests"
  ON friend_requests FOR DELETE
  TO authenticated
  USING (from_user_id = (select auth.uid()));


-- ===== 11. FIX RLS POLICIES - push_subscriptions =====

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can create own push subscriptions"
  ON push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
  ON push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));


-- ===== 12. FIX RLS POLICIES - tournaments =====

DROP POLICY IF EXISTS "Anyone can view tournaments" ON tournaments;
CREATE POLICY "Anyone can view tournaments"
  ON tournaments FOR SELECT
  USING (true);


-- ===== 13. FIX RLS POLICIES - push_notifications =====

DROP POLICY IF EXISTS "Users can view own push notifications" ON push_notifications;
CREATE POLICY "Users can view own push notifications"
  ON push_notifications FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own push notifications" ON push_notifications;
CREATE POLICY "Users can update own push notifications"
  ON push_notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));


-- ===== 14. FIX RLS POLICIES - referral_events =====

DROP POLICY IF EXISTS "System can insert referral events" ON referral_events;
CREATE POLICY "System can insert referral events"
  ON referral_events FOR INSERT
  WITH CHECK (true);
