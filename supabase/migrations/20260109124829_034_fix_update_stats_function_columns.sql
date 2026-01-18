/*
  # Fix update_player_statistics_summary Column Names

  ## Issue
  The function was using incorrect column names (pvp_* instead of human_*)

  ## Changes
  - Update function to use correct column names from player_statistics_summary table
  - Use human_* columns instead of pvp_* columns
*/

DROP FUNCTION IF EXISTS update_player_statistics_summary(uuid);

CREATE FUNCTION update_player_statistics_summary(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Ensure player has a record in player_statistics_summary
  INSERT INTO player_statistics_summary (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  -- Calculate and update all-time stats
  UPDATE player_statistics_summary
  SET
    lifetime_matches_played = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_matches_won = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND won = true
    ), 0),
    lifetime_average = (
      SELECT AVG(three_dart_average) FROM leg_statistics WHERE player_id = p_player_id
    ),
    lifetime_best_average = (
      SELECT MAX(three_dart_average) FROM leg_statistics WHERE player_id = p_player_id
    ),
    lifetime_180s = COALESCE((
      SELECT SUM(visits_180) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_checkouts_hit = COALESCE((
      SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id AND was_successful = true
    ), 0),
    lifetime_checkout_attempts = COALESCE((
      SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id
    ), 0),
    lifetime_highest_checkout = (
      SELECT MAX(checkout_value) FROM checkout_attempts WHERE player_id = p_player_id AND was_successful = true
    ),

    -- Bot match stats
    bot_matches_played = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'bot'
    ), 0),
    bot_matches_won = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'bot' AND won = true
    ), 0),
    bot_average = (
      SELECT AVG(ls.three_dart_average)
      FROM leg_statistics ls
      JOIN match_statistics ms ON ls.room_id = ms.room_id
      WHERE ls.player_id = p_player_id AND ms.game_mode = 'bot'
    ),
    bot_highest_checkout = (
      SELECT MAX(ca.checkout_value)
      FROM checkout_attempts ca
      JOIN match_statistics ms ON ca.room_id = ms.room_id
      WHERE ca.player_id = p_player_id AND ms.game_mode = 'bot' AND ca.was_successful = true
    ),

    -- Human (PvP) match stats
    human_matches_played = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'pvp'
    ), 0),
    human_matches_won = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'pvp' AND won = true
    ), 0),
    human_average = (
      SELECT AVG(ls.three_dart_average)
      FROM leg_statistics ls
      JOIN match_statistics ms ON ls.room_id = ms.room_id
      WHERE ls.player_id = p_player_id AND ms.game_mode = 'pvp'
    ),
    human_highest_checkout = (
      SELECT MAX(ca.checkout_value)
      FROM checkout_attempts ca
      JOIN match_statistics ms ON ca.room_id = ms.room_id
      WHERE ca.player_id = p_player_id AND ms.game_mode = 'pvp' AND ca.was_successful = true
    ),

    -- Local match stats
    local_matches_played = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'local'
    ), 0),
    local_average = (
      SELECT AVG(ls.three_dart_average)
      FROM leg_statistics ls
      JOIN match_statistics ms ON ls.room_id = ms.room_id
      WHERE ls.player_id = p_player_id AND ms.game_mode = 'local'
    ),

    -- 30 day rolling
    rolling_30d_matches = COALESCE((
      SELECT COUNT(*) FROM match_statistics
      WHERE player_id = p_player_id AND created_at > NOW() - INTERVAL '30 days'
    ), 0),
    rolling_30d_wins = COALESCE((
      SELECT COUNT(*) FROM match_statistics
      WHERE player_id = p_player_id AND won = true AND created_at > NOW() - INTERVAL '30 days'
    ), 0),
    rolling_30d_average = (
      SELECT AVG(three_dart_average) FROM leg_statistics
      WHERE player_id = p_player_id AND created_at > NOW() - INTERVAL '30 days'
    ),

    last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE player_id = p_player_id;
  
  -- Also update user_profile stats
  UPDATE user_profile
  SET
    total_games_played = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id
    ), 0),
    total_wins = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND won = true
    ), 0),
    average_score = COALESCE((
      SELECT AVG(three_dart_average) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    best_average = COALESCE((
      SELECT MAX(three_dart_average) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    highest_checkout = COALESCE((
      SELECT MAX(checkout_value) FROM checkout_attempts WHERE player_id = p_player_id AND was_successful = true
    ), 0),
    total_checkouts = COALESCE((
      SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id AND was_successful = true
    ), 0),
    updated_at = NOW()
  WHERE id = p_player_id;
END;
$$;
