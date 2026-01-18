/*
  # Add Missing Foreign Key Indexes

  ## Performance Improvements
  
  Adding indexes for all unindexed foreign keys improves:
  - JOIN performance
  - Foreign key constraint checking
  - DELETE CASCADE operations
  - Query optimization

  This migration adds 65+ indexes for foreign keys across all tables.
*/

-- app_config
CREATE INDEX IF NOT EXISTS idx_app_config_updated_by ON app_config(updated_by_user_id);

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);

-- checkout_attempts
CREATE INDEX IF NOT EXISTS idx_checkout_attempts_leg_stat ON checkout_attempts(leg_stat_id);
CREATE INDEX IF NOT EXISTS idx_checkout_attempts_room ON checkout_attempts(room_id);

-- club_feed_posts
CREATE INDEX IF NOT EXISTS idx_club_feed_posts_club ON club_feed_posts(club_id);
CREATE INDEX IF NOT EXISTS idx_club_feed_posts_user ON club_feed_posts(user_id);

-- club_invites
CREATE INDEX IF NOT EXISTS idx_club_invites_club ON club_invites(club_id);
CREATE INDEX IF NOT EXISTS idx_club_invites_invitee ON club_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_club_invites_inviter ON club_invites(inviter_id);

-- clubs
CREATE INDEX IF NOT EXISTS idx_clubs_created_by ON clubs(created_by);

-- friendships
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);

-- game_events
CREATE INDEX IF NOT EXISTS idx_game_events_player ON game_events(player_id);
CREATE INDEX IF NOT EXISTS idx_game_events_room ON game_events(room_id);

-- game_invites
CREATE INDEX IF NOT EXISTS idx_game_invites_invitee ON game_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_game_invites_inviter ON game_invites(inviter_id);
CREATE INDEX IF NOT EXISTS idx_game_invites_room ON game_invites(room_id);

-- game_players
CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);

-- game_rooms
CREATE INDEX IF NOT EXISTS idx_game_rooms_winner ON game_rooms(winner_id);

-- game_turns
CREATE INDEX IF NOT EXISTS idx_game_turns_player ON game_turns(player_id);
CREATE INDEX IF NOT EXISTS idx_game_turns_room ON game_turns(room_id);
CREATE INDEX IF NOT EXISTS idx_game_turns_undone_by ON game_turns(undone_by);

-- match_statistics
CREATE INDEX IF NOT EXISTS idx_match_statistics_room ON match_statistics(room_id);

-- media_assets
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_by ON media_assets(uploaded_by);

-- multiplayer_game_players
CREATE INDEX IF NOT EXISTS idx_mp_game_players_user ON multiplayer_game_players(user_id);

-- multiplayer_game_turns
CREATE INDEX IF NOT EXISTS idx_mp_game_turns_game ON multiplayer_game_turns(game_id);
CREATE INDEX IF NOT EXISTS idx_mp_game_turns_player ON multiplayer_game_turns(player_id);

-- multiplayer_games
CREATE INDEX IF NOT EXISTS idx_mp_games_host ON multiplayer_games(host_user_id);

-- notification_receipts
CREATE INDEX IF NOT EXISTS idx_notification_receipts_notification ON notification_receipts(notification_id);

-- notification_targets
CREATE INDEX IF NOT EXISTS idx_notification_targets_notification ON notification_targets(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_targets_user ON notification_targets(user_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON notifications(created_by);

-- password_reset_tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- player_profiles
CREATE INDEX IF NOT EXISTS idx_player_profiles_user ON player_profiles(user_id);

-- program_enrollments
CREATE INDEX IF NOT EXISTS idx_program_enrollments_program ON program_enrollments(program_id);

-- push_notifications
CREATE INDEX IF NOT EXISTS idx_push_notifications_user ON push_notifications(user_id);

-- referral_events
CREATE INDEX IF NOT EXISTS idx_referral_events_code ON referral_events(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referred ON referral_events(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events(referrer_id);

-- referral_rewards_ledger
CREATE INDEX IF NOT EXISTS idx_referral_rewards_event ON referral_rewards_ledger(source_event_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON referral_rewards_ledger(user_id);

-- token_ledger
CREATE INDEX IF NOT EXISTS idx_token_ledger_user ON token_ledger(user_id);

-- tournament_brackets
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_next_match ON tournament_brackets(next_match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_player1 ON tournament_brackets(player1_entry_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_player2 ON tournament_brackets(player2_entry_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_tournament ON tournament_brackets(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_winner ON tournament_brackets(winner_entry_id);

-- tournament_events
CREATE INDEX IF NOT EXISTS idx_tournament_events_match ON tournament_events(match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_events_tournament ON tournament_events(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_events_user ON tournament_events(user_id);

-- tournament_matches
CREATE INDEX IF NOT EXISTS idx_tournament_matches_bracket ON tournament_matches(bracket_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_game_room ON tournament_matches(game_room_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player1 ON tournament_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player2 ON tournament_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_winner ON tournament_matches(winner_id);

-- tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_club ON tournaments(club_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by ON tournaments(created_by);
CREATE INDEX IF NOT EXISTS idx_tournaments_winner ON tournaments(winner_id);

-- training_drill_statistics
CREATE INDEX IF NOT EXISTS idx_training_drill_stats_session ON training_drill_statistics(training_session_id);

-- training_session_events
CREATE INDEX IF NOT EXISTS idx_training_session_events_session ON training_session_events(session_id);

-- training_sessions
CREATE INDEX IF NOT EXISTS idx_training_sessions_drill ON training_sessions(drill_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_program ON training_sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_user ON training_sessions(user_id);

-- turn_evidence
CREATE INDEX IF NOT EXISTS idx_turn_evidence_player ON turn_evidence(player_id);
CREATE INDEX IF NOT EXISTS idx_turn_evidence_reviewed_by ON turn_evidence(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_turn_evidence_room ON turn_evidence(room_id);
CREATE INDEX IF NOT EXISTS idx_turn_evidence_turn ON turn_evidence(turn_id);
