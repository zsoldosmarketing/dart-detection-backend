/*
  # Add Critical Foreign Key Indexes

  ## Performance Improvements
  
  Adding indexes for remaining unindexed foreign keys on frequently queried tables:
  - dart_throws (player_id, room_id, training_session_id, turn_id)
  - leg_statistics (player_id, room_id)
  - match_statistics (player_id, opponent_id)
  - checkout_attempts (player_id)
  - training_drill_statistics (player_id, drill_id)
  - multiplayer_games (game_mode_id, winner_user_id)

  These tables are actively used in gameplay and statistics tracking.
*/

-- dart_throws - Critical for game play tracking
CREATE INDEX IF NOT EXISTS idx_dart_throws_player_fk ON dart_throws(player_id);
CREATE INDEX IF NOT EXISTS idx_dart_throws_room_fk ON dart_throws(room_id);
CREATE INDEX IF NOT EXISTS idx_dart_throws_turn_fk ON dart_throws(turn_id);
CREATE INDEX IF NOT EXISTS idx_dart_throws_training_fk ON dart_throws(training_session_id);

-- leg_statistics - Critical for statistics
CREATE INDEX IF NOT EXISTS idx_leg_statistics_player_fk ON leg_statistics(player_id);
CREATE INDEX IF NOT EXISTS idx_leg_statistics_room_fk ON leg_statistics(room_id);

-- match_statistics - Critical for match history
CREATE INDEX IF NOT EXISTS idx_match_statistics_player_fk ON match_statistics(player_id);
CREATE INDEX IF NOT EXISTS idx_match_statistics_opponent_fk ON match_statistics(opponent_id);

-- checkout_attempts - Critical for checkout tracking
CREATE INDEX IF NOT EXISTS idx_checkout_attempts_player_fk ON checkout_attempts(player_id);

-- training_drill_statistics - Critical for training
CREATE INDEX IF NOT EXISTS idx_training_drill_statistics_player_fk ON training_drill_statistics(player_id);
CREATE INDEX IF NOT EXISTS idx_training_drill_statistics_drill_fk ON training_drill_statistics(drill_id);

-- multiplayer_games - Used for game mode tracking
CREATE INDEX IF NOT EXISTS idx_multiplayer_games_game_mode_fk ON multiplayer_games(game_mode_id);
CREATE INDEX IF NOT EXISTS idx_multiplayer_games_winner_fk ON multiplayer_games(winner_user_id);
