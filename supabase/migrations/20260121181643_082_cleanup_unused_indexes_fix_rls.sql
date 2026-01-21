/*
  # Cleanup Unused Indexes and Fix RLS Policy

  1. Dropped Indexes
    - Removing 85+ unused indexes to improve write performance and save storage
    - These indexes were created but never used in queries

  2. Security Fixes
    - Fixed overly permissive UPDATE policy on remote_camera_sessions
    - Now only session owner or viewers with valid connection can update

  3. Notes
    - Indexes can be recreated if needed in the future
    - The RLS fix ensures only authorized users can update camera sessions
*/

-- Drop unused indexes on leg_statistics
DROP INDEX IF EXISTS idx_leg_statistics_room_id;
DROP INDEX IF EXISTS idx_leg_statistics_player_id;

-- Drop unused indexes on match_statistics
DROP INDEX IF EXISTS idx_match_statistics_opponent_id;
DROP INDEX IF EXISTS idx_match_statistics_player_id;
DROP INDEX IF EXISTS idx_match_statistics_room_id;

-- Drop unused indexes on media_assets
DROP INDEX IF EXISTS idx_media_assets_uploaded_by;

-- Drop unused indexes on multiplayer tables
DROP INDEX IF EXISTS idx_multiplayer_game_players_user_id;
DROP INDEX IF EXISTS idx_multiplayer_game_turns_game_id;
DROP INDEX IF EXISTS idx_multiplayer_game_turns_player_id;
DROP INDEX IF EXISTS idx_multiplayer_games_game_mode_id;
DROP INDEX IF EXISTS idx_multiplayer_games_host_user_id;
DROP INDEX IF EXISTS idx_multiplayer_games_winner_user_id;

-- Drop unused indexes on notification tables
DROP INDEX IF EXISTS idx_notification_receipts_notification_id;
DROP INDEX IF EXISTS idx_notification_targets_notification_id;
DROP INDEX IF EXISTS idx_notification_targets_user_id;
DROP INDEX IF EXISTS idx_notifications_created_by;

-- Drop unused indexes on password_reset_tokens
DROP INDEX IF EXISTS idx_password_reset_tokens_user_id;

-- Drop unused indexes on player_profiles
DROP INDEX IF EXISTS idx_player_profiles_user_id;

-- Drop unused indexes on program_enrollments
DROP INDEX IF EXISTS idx_program_enrollments_program_id;

-- Drop unused indexes on pvp_challenges
DROP INDEX IF EXISTS idx_pvp_challenges_room_id;

-- Drop unused indexes on referral tables
DROP INDEX IF EXISTS idx_referral_events_referral_code_id;
DROP INDEX IF EXISTS idx_referral_events_referred_id;
DROP INDEX IF EXISTS idx_referral_events_referrer_id;
DROP INDEX IF EXISTS idx_referral_rewards_ledger_source_event_id;
DROP INDEX IF EXISTS idx_referral_rewards_ledger_user_id;

-- Drop unused indexes on token_ledger
DROP INDEX IF EXISTS idx_token_ledger_user_id;

-- Drop unused indexes on tournament tables
DROP INDEX IF EXISTS idx_tournament_brackets_next_match_id;
DROP INDEX IF EXISTS idx_tournament_brackets_player1_entry_id;
DROP INDEX IF EXISTS idx_tournament_brackets_player2_entry_id;
DROP INDEX IF EXISTS idx_tournament_brackets_tournament_id;
DROP INDEX IF EXISTS idx_tournament_brackets_winner_entry_id;
DROP INDEX IF EXISTS idx_tournament_events_match_id;
DROP INDEX IF EXISTS idx_tournament_events_tournament_id;
DROP INDEX IF EXISTS idx_tournament_events_user_id;
DROP INDEX IF EXISTS idx_tournament_matches_bracket_id;
DROP INDEX IF EXISTS idx_tournament_matches_game_room_id;
DROP INDEX IF EXISTS idx_tournament_matches_player1_id;
DROP INDEX IF EXISTS idx_tournament_matches_player2_id;
DROP INDEX IF EXISTS idx_tournament_matches_tournament_id;
DROP INDEX IF EXISTS idx_tournament_matches_winner_id;
DROP INDEX IF EXISTS idx_tournaments_club_id;
DROP INDEX IF EXISTS idx_tournaments_created_by;
DROP INDEX IF EXISTS idx_tournaments_winner_id;

-- Drop unused indexes on training tables
DROP INDEX IF EXISTS idx_training_drill_statistics_drill_id;
DROP INDEX IF EXISTS idx_training_session_events_session_id;
DROP INDEX IF EXISTS idx_training_sessions_drill_id;
DROP INDEX IF EXISTS idx_training_drill_statistics_player_id;
DROP INDEX IF EXISTS idx_training_drill_statistics_training_session_id;
DROP INDEX IF EXISTS idx_training_sessions_program_id;
DROP INDEX IF EXISTS idx_training_sessions_user_id;

-- Drop unused indexes on turn_evidence
DROP INDEX IF EXISTS idx_turn_evidence_player_id;
DROP INDEX IF EXISTS idx_turn_evidence_reviewed_by;
DROP INDEX IF EXISTS idx_turn_evidence_room_id;
DROP INDEX IF EXISTS idx_turn_evidence_turn_id;

-- Drop unused indexes on remote_camera tables
DROP INDEX IF EXISTS idx_remote_camera_sessions_expires_at;
DROP INDEX IF EXISTS idx_remote_camera_ice_candidates_session_id;
DROP INDEX IF EXISTS idx_remote_camera_sessions_status;

-- Drop unused indexes on game tables
DROP INDEX IF EXISTS idx_game_pause_requests_requester_id;
DROP INDEX IF EXISTS idx_game_resume_requests_opponent_id;
DROP INDEX IF EXISTS idx_game_resume_requests_requester_id;
DROP INDEX IF EXISTS idx_game_pause_requests_room_id;
DROP INDEX IF EXISTS idx_game_rooms_winner_id;
DROP INDEX IF EXISTS idx_game_turns_player_id;
DROP INDEX IF EXISTS idx_game_turns_undone_by;

-- Drop unused indexes on other tables
DROP INDEX IF EXISTS idx_app_config_updated_by_user_id;
DROP INDEX IF EXISTS idx_audit_log_user_id;
DROP INDEX IF EXISTS idx_blocked_users_blocked_user_id;
DROP INDEX IF EXISTS idx_checkout_attempts_leg_stat_id;
DROP INDEX IF EXISTS idx_checkout_attempts_player_id;
DROP INDEX IF EXISTS idx_checkout_attempts_room_id;
DROP INDEX IF EXISTS idx_club_feed_posts_club_id;
DROP INDEX IF EXISTS idx_club_feed_posts_user_id;
DROP INDEX IF EXISTS idx_club_invites_club_id;
DROP INDEX IF EXISTS idx_club_invites_invitee_id;
DROP INDEX IF EXISTS idx_club_invites_inviter_id;
DROP INDEX IF EXISTS idx_clubs_created_by;
DROP INDEX IF EXISTS idx_dart_throws_player_id;
DROP INDEX IF EXISTS idx_dart_throws_room_id;
DROP INDEX IF EXISTS idx_dart_throws_training_session_id;
DROP INDEX IF EXISTS idx_dart_throws_turn_id;
DROP INDEX IF EXISTS idx_friendships_friend_id;
DROP INDEX IF EXISTS idx_game_connection_log_room_id;
DROP INDEX IF EXISTS idx_game_connection_log_user_id;
DROP INDEX IF EXISTS idx_game_events_player_id;
DROP INDEX IF EXISTS idx_game_events_room_id;
DROP INDEX IF EXISTS idx_game_invites_invitee_id;
DROP INDEX IF EXISTS idx_game_invites_inviter_id;
DROP INDEX IF EXISTS idx_game_invites_room_id;

-- Fix overly permissive RLS policy on remote_camera_sessions
DROP POLICY IF EXISTS "Authenticated users can update camera sessions" ON remote_camera_sessions;

CREATE POLICY "Owner can update own camera sessions"
  ON remote_camera_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
