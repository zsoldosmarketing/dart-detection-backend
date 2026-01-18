/*
  # Add Missing Foreign Key Indexes
  
  1. Performance Improvements
    - Add indexes for all unindexed foreign key columns
    - Improves JOIN performance and foreign key constraint checks
    
  2. Affected Tables
    - app_config, club_feed_posts, club_invites, clubs
    - game_events, game_invites, game_rooms, game_turns
    - media_assets, notification_receipts, notifications
    - password_reset_tokens, referral_events, referral_rewards_ledger
    - tournament_brackets, tournament_entries, tournament_events
    - tournament_matches, tournaments, training_session_events
    - training_sessions, turn_evidence
*/

-- app_config
CREATE INDEX IF NOT EXISTS idx_app_config_updated_by_user_id ON app_config(updated_by_user_id);

-- club_feed_posts
CREATE INDEX IF NOT EXISTS idx_club_feed_posts_user_id ON club_feed_posts(user_id);

-- club_invites
CREATE INDEX IF NOT EXISTS idx_club_invites_club_id ON club_invites(club_id);
CREATE INDEX IF NOT EXISTS idx_club_invites_invitee_id ON club_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_club_invites_inviter_id ON club_invites(inviter_id);

-- clubs
CREATE INDEX IF NOT EXISTS idx_clubs_created_by ON clubs(created_by);

-- game_events
CREATE INDEX IF NOT EXISTS idx_game_events_player_id ON game_events(player_id);
CREATE INDEX IF NOT EXISTS idx_game_events_room_id ON game_events(room_id);

-- game_invites
CREATE INDEX IF NOT EXISTS idx_game_invites_inviter_id ON game_invites(inviter_id);
CREATE INDEX IF NOT EXISTS idx_game_invites_room_id ON game_invites(room_id);

-- game_rooms
CREATE INDEX IF NOT EXISTS idx_game_rooms_winner_id ON game_rooms(winner_id);

-- game_turns
CREATE INDEX IF NOT EXISTS idx_game_turns_player_id ON game_turns(player_id);
CREATE INDEX IF NOT EXISTS idx_game_turns_undone_by ON game_turns(undone_by);

-- media_assets
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by ON media_assets(uploaded_by);

-- notification_receipts
CREATE INDEX IF NOT EXISTS idx_notification_receipts_notification_id ON notification_receipts(notification_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON notifications(created_by);

-- password_reset_tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- referral_events
CREATE INDEX IF NOT EXISTS idx_referral_events_referral_code_id ON referral_events(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referred_id ON referral_events(referred_id);

-- referral_rewards_ledger
CREATE INDEX IF NOT EXISTS idx_referral_rewards_ledger_source_event_id ON referral_rewards_ledger(source_event_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_ledger_user_id ON referral_rewards_ledger(user_id);

-- tournament_brackets
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_next_match_id ON tournament_brackets(next_match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_player1_entry_id ON tournament_brackets(player1_entry_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_player2_entry_id ON tournament_brackets(player2_entry_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_winner_entry_id ON tournament_brackets(winner_entry_id);

-- tournament_entries
CREATE INDEX IF NOT EXISTS idx_tournament_entries_user_id ON tournament_entries(user_id);

-- tournament_events
CREATE INDEX IF NOT EXISTS idx_tournament_events_match_id ON tournament_events(match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_events_tournament_id ON tournament_events(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_events_user_id ON tournament_events(user_id);

-- tournament_matches
CREATE INDEX IF NOT EXISTS idx_tournament_matches_bracket_id ON tournament_matches(bracket_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_game_room_id ON tournament_matches(game_room_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player1_id ON tournament_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player2_id ON tournament_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_winner_id ON tournament_matches(winner_id);

-- tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_club_id ON tournaments(club_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by ON tournaments(created_by);
CREATE INDEX IF NOT EXISTS idx_tournaments_winner_id ON tournaments(winner_id);

-- training_session_events
CREATE INDEX IF NOT EXISTS idx_training_session_events_session_id ON training_session_events(session_id);

-- training_sessions
CREATE INDEX IF NOT EXISTS idx_training_sessions_program_id ON training_sessions(program_id);

-- turn_evidence
CREATE INDEX IF NOT EXISTS idx_turn_evidence_player_id ON turn_evidence(player_id);
CREATE INDEX IF NOT EXISTS idx_turn_evidence_reviewed_by ON turn_evidence(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_turn_evidence_room_id ON turn_evidence(room_id);
CREATE INDEX IF NOT EXISTS idx_turn_evidence_turn_id ON turn_evidence(turn_id);
