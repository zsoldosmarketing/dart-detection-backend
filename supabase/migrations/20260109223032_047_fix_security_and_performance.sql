/*
  # Fix Security and Performance Issues

  1. Missing Indexes
    - Add index on game_pause_requests.requester_id

  2. Drop Unused Indexes
    - Remove indexes that are not being used to improve write performance

  3. Function Security
    - Fix search_path for accept_friend_request function
*/

-- Add missing index
CREATE INDEX IF NOT EXISTS idx_game_pause_requests_requester ON game_pause_requests(requester_id);

-- Drop unused indexes
DROP INDEX IF EXISTS idx_dart_throws_player_fk;
DROP INDEX IF EXISTS idx_dart_throws_room_fk;
DROP INDEX IF EXISTS idx_dart_throws_turn_fk;
DROP INDEX IF EXISTS idx_dart_throws_training_fk;
DROP INDEX IF EXISTS idx_leg_statistics_player_fk;
DROP INDEX IF EXISTS idx_leg_statistics_room_fk;
DROP INDEX IF EXISTS idx_match_statistics_player_fk;
DROP INDEX IF EXISTS idx_match_statistics_opponent_fk;
DROP INDEX IF EXISTS idx_checkout_attempts_player_fk;
DROP INDEX IF EXISTS idx_training_drill_statistics_player_fk;
DROP INDEX IF EXISTS idx_training_drill_statistics_drill_fk;
DROP INDEX IF EXISTS idx_multiplayer_games_game_mode_fk;
DROP INDEX IF EXISTS idx_connection_log_room;
DROP INDEX IF EXISTS idx_connection_log_user;
DROP INDEX IF EXISTS idx_connection_log_created;
DROP INDEX IF EXISTS idx_multiplayer_games_winner_fk;
DROP INDEX IF EXISTS idx_blocked_users_user_id;
DROP INDEX IF EXISTS idx_blocked_users_blocked_user_id;
DROP INDEX IF EXISTS idx_pvp_challenges_room_id;
DROP INDEX IF EXISTS idx_game_turns_player;
DROP INDEX IF EXISTS idx_app_config_updated_by;
DROP INDEX IF EXISTS idx_audit_log_user_id;
DROP INDEX IF EXISTS idx_checkout_attempts_leg_stat;
DROP INDEX IF EXISTS idx_checkout_attempts_room;
DROP INDEX IF EXISTS idx_club_feed_posts_club;
DROP INDEX IF EXISTS idx_club_feed_posts_user;
DROP INDEX IF EXISTS idx_club_invites_club;
DROP INDEX IF EXISTS idx_club_invites_invitee;
DROP INDEX IF EXISTS idx_club_invites_inviter;
DROP INDEX IF EXISTS idx_clubs_created_by;
DROP INDEX IF EXISTS idx_friendships_friend;
DROP INDEX IF EXISTS idx_game_events_player;
DROP INDEX IF EXISTS idx_game_events_room;
DROP INDEX IF EXISTS idx_game_invites_invitee;
DROP INDEX IF EXISTS idx_game_invites_inviter;
DROP INDEX IF EXISTS idx_game_invites_room;
DROP INDEX IF EXISTS idx_game_players_user;
DROP INDEX IF EXISTS idx_game_turns_room;
DROP INDEX IF EXISTS idx_game_rooms_winner;
DROP INDEX IF EXISTS idx_game_turns_undone_by;
DROP INDEX IF EXISTS idx_match_statistics_room;
DROP INDEX IF EXISTS idx_media_assets_uploaded_by;
DROP INDEX IF EXISTS idx_mp_game_players_user;
DROP INDEX IF EXISTS idx_tournament_brackets_next_match;
DROP INDEX IF EXISTS idx_mp_game_turns_game;
DROP INDEX IF EXISTS idx_mp_game_turns_player;
DROP INDEX IF EXISTS idx_mp_games_host;
DROP INDEX IF EXISTS idx_notification_receipts_notification;
DROP INDEX IF EXISTS idx_notification_targets_notification;
DROP INDEX IF EXISTS idx_notification_targets_user;
DROP INDEX IF EXISTS idx_notifications_created_by;
DROP INDEX IF EXISTS idx_password_reset_tokens_user;
DROP INDEX IF EXISTS idx_player_profiles_user;
DROP INDEX IF EXISTS idx_program_enrollments_program;
DROP INDEX IF EXISTS idx_referral_events_code;
DROP INDEX IF EXISTS idx_referral_events_referred;
DROP INDEX IF EXISTS idx_referral_events_referrer;
DROP INDEX IF EXISTS idx_referral_rewards_event;
DROP INDEX IF EXISTS idx_referral_rewards_user;
DROP INDEX IF EXISTS idx_token_ledger_user;
DROP INDEX IF EXISTS idx_tournament_brackets_player1;
DROP INDEX IF EXISTS idx_tournament_brackets_player2;
DROP INDEX IF EXISTS idx_tournament_brackets_tournament;
DROP INDEX IF EXISTS idx_tournament_brackets_winner;
DROP INDEX IF EXISTS idx_tournament_events_match;
DROP INDEX IF EXISTS idx_tournament_events_tournament;
DROP INDEX IF EXISTS idx_tournament_events_user;
DROP INDEX IF EXISTS idx_tournament_matches_bracket;
DROP INDEX IF EXISTS idx_tournament_matches_game_room;
DROP INDEX IF EXISTS idx_tournament_matches_player1;
DROP INDEX IF EXISTS idx_tournament_matches_player2;
DROP INDEX IF EXISTS idx_tournament_matches_tournament;
DROP INDEX IF EXISTS idx_tournament_matches_winner;
DROP INDEX IF EXISTS idx_tournaments_club;
DROP INDEX IF EXISTS idx_tournaments_created_by;
DROP INDEX IF EXISTS idx_tournaments_winner;
DROP INDEX IF EXISTS idx_training_drill_stats_session;
DROP INDEX IF EXISTS idx_training_session_events_session;
DROP INDEX IF EXISTS idx_training_sessions_drill;
DROP INDEX IF EXISTS idx_training_sessions_program;
DROP INDEX IF EXISTS idx_training_sessions_user;
DROP INDEX IF EXISTS idx_turn_evidence_player;
DROP INDEX IF EXISTS idx_turn_evidence_reviewed_by;
DROP INDEX IF EXISTS idx_turn_evidence_room;
DROP INDEX IF EXISTS idx_turn_evidence_turn;
DROP INDEX IF EXISTS idx_pause_requests_room;
DROP INDEX IF EXISTS idx_pause_requests_status;

-- Fix function search_path
CREATE OR REPLACE FUNCTION accept_friend_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  req friend_requests;
BEGIN
  SELECT * INTO req FROM friend_requests WHERE id = request_id AND to_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  IF req.status != 'pending' THEN
    RAISE EXCEPTION 'Friend request already processed';
  END IF;

  UPDATE friend_requests SET status = 'accepted', updated_at = now() WHERE id = request_id;

  INSERT INTO friendships (user_id, friend_id)
  VALUES (req.from_user_id, req.to_user_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;

  INSERT INTO friendships (user_id, friend_id)
  VALUES (req.to_user_id, req.from_user_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$;