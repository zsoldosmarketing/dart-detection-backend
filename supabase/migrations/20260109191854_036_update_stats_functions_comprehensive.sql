/*
  # Update Statistics Functions for Comprehensive Tracking

  ## Changes
  
  1. **update_player_statistics_summary**
     - Add calculations for new statistics columns
     - Include first_9_average, 60+, 100+, 140+ visits
     - Calculate sector hits aggregation
     - Calculate win percentages properly
  
  2. **Enhanced Calculations**
     - Proper percentage calculations with division by zero protection
     - Sector hits aggregation from leg_statistics
*/

DROP FUNCTION IF EXISTS update_player_statistics_summary(uuid);

CREATE FUNCTION update_player_statistics_summary(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lifetime_matches int;
  v_lifetime_wins int;
  v_bot_matches int;
  v_bot_wins int;
  v_human_matches int;
  v_human_wins int;
BEGIN
  -- Ensure player has a record in player_statistics_summary
  INSERT INTO player_statistics_summary (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  -- Get match counts
  SELECT 
    COUNT(*) FILTER (WHERE TRUE),
    COUNT(*) FILTER (WHERE won = true),
    COUNT(*) FILTER (WHERE game_mode = 'bot'),
    COUNT(*) FILTER (WHERE game_mode = 'bot' AND won = true),
    COUNT(*) FILTER (WHERE game_mode = 'pvp'),
    COUNT(*) FILTER (WHERE game_mode = 'pvp' AND won = true)
  INTO v_lifetime_matches, v_lifetime_wins, v_bot_matches, v_bot_wins, v_human_matches, v_human_wins
  FROM match_statistics
  WHERE player_id = p_player_id;

  -- Calculate and update all-time stats
  UPDATE player_statistics_summary
  SET
    lifetime_matches_played = v_lifetime_matches,
    lifetime_matches_won = v_lifetime_wins,
    lifetime_win_percentage = CASE WHEN v_lifetime_matches > 0 THEN (v_lifetime_wins::numeric / v_lifetime_matches::numeric * 100) ELSE 0 END,
    
    lifetime_average = COALESCE((
      SELECT AVG(three_dart_average) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_best_average = COALESCE((
      SELECT MAX(three_dart_average) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_first_9_average = COALESCE((
      SELECT AVG(first_9_average) FROM leg_statistics WHERE player_id = p_player_id AND first_9_average > 0
    ), 0),
    
    lifetime_180s = COALESCE((
      SELECT SUM(visits_180) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_171_179 = COALESCE((
      SELECT SUM(visits_171_179) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_160_170 = COALESCE((
      SELECT SUM(visits_160_170) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_140_159 = COALESCE((
      SELECT SUM(visits_140_159) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_100_139 = COALESCE((
      SELECT SUM(visits_100_139) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_60_plus = COALESCE((
      SELECT SUM(visits_60_plus) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_100_plus = COALESCE((
      SELECT SUM(visits_100_plus) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_140_plus = COALESCE((
      SELECT SUM(visits_140_plus) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    
    lifetime_doubles_hit = COALESCE((
      SELECT SUM(doubles_hit) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_doubles_thrown = COALESCE((
      SELECT SUM(doubles_thrown) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_double_percentage = CASE 
      WHEN COALESCE((SELECT SUM(doubles_thrown) FROM leg_statistics WHERE player_id = p_player_id), 0) > 0 
      THEN (COALESCE((SELECT SUM(doubles_hit) FROM leg_statistics WHERE player_id = p_player_id), 0)::numeric / 
            COALESCE((SELECT SUM(doubles_thrown) FROM leg_statistics WHERE player_id = p_player_id), 1)::numeric * 100) 
      ELSE 0 
    END,
    
    lifetime_triples_hit = COALESCE((
      SELECT SUM(triples_hit) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_triples_thrown = COALESCE((
      SELECT SUM(triples_thrown) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    lifetime_triple_percentage = CASE 
      WHEN COALESCE((SELECT SUM(triples_thrown) FROM leg_statistics WHERE player_id = p_player_id), 0) > 0 
      THEN (COALESCE((SELECT SUM(triples_hit) FROM leg_statistics WHERE player_id = p_player_id), 0)::numeric / 
            COALESCE((SELECT SUM(triples_thrown) FROM leg_statistics WHERE player_id = p_player_id), 1)::numeric * 100) 
      ELSE 0 
    END,
    
    lifetime_checkouts_hit = COALESCE((
      SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id AND was_successful = true
    ), 0),
    lifetime_checkout_attempts = COALESCE((
      SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id
    ), 0),
    lifetime_checkout_percentage = CASE 
      WHEN COALESCE((SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id), 0) > 0 
      THEN (COALESCE((SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id AND was_successful = true), 0)::numeric / 
            COALESCE((SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id), 1)::numeric * 100) 
      ELSE 0 
    END,
    lifetime_highest_checkout = COALESCE((
      SELECT MAX(checkout_value) FROM checkout_attempts WHERE player_id = p_player_id AND was_successful = true
    ), 0),
    lifetime_best_leg_darts = COALESCE((
      SELECT MIN(total_darts) FROM leg_statistics WHERE player_id = p_player_id AND total_darts > 0
    ), 0),

    -- Bot match stats
    bot_matches_played = v_bot_matches,
    bot_matches_won = v_bot_wins,
    bot_win_percentage = CASE WHEN v_bot_matches > 0 THEN (v_bot_wins::numeric / v_bot_matches::numeric * 100) ELSE 0 END,
    bot_average = COALESCE((
      SELECT AVG(ls.three_dart_average)
      FROM leg_statistics ls
      JOIN match_statistics ms ON ls.room_id = ms.room_id
      WHERE ls.player_id = p_player_id AND ms.game_mode = 'bot'
    ), 0),
    bot_highest_checkout = COALESCE((
      SELECT MAX(ca.checkout_value)
      FROM checkout_attempts ca
      JOIN match_statistics ms ON ca.room_id = ms.room_id
      WHERE ca.player_id = p_player_id AND ms.game_mode = 'bot' AND ca.was_successful = true
    ), 0),

    -- Human (PvP) match stats
    human_matches_played = v_human_matches,
    human_matches_won = v_human_wins,
    human_win_percentage = CASE WHEN v_human_matches > 0 THEN (v_human_wins::numeric / v_human_matches::numeric * 100) ELSE 0 END,
    human_average = COALESCE((
      SELECT AVG(ls.three_dart_average)
      FROM leg_statistics ls
      JOIN match_statistics ms ON ls.room_id = ms.room_id
      WHERE ls.player_id = p_player_id AND ms.game_mode = 'pvp'
    ), 0),
    human_highest_checkout = COALESCE((
      SELECT MAX(ca.checkout_value)
      FROM checkout_attempts ca
      JOIN match_statistics ms ON ca.room_id = ms.room_id
      WHERE ca.player_id = p_player_id AND ms.game_mode = 'pvp' AND ca.was_successful = true
    ), 0),

    -- Local match stats
    local_matches_played = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'local'
    ), 0),
    local_average = COALESCE((
      SELECT AVG(ls.three_dart_average)
      FROM leg_statistics ls
      JOIN match_statistics ms ON ls.room_id = ms.room_id
      WHERE ls.player_id = p_player_id AND ms.game_mode = 'local'
    ), 0),

    -- 30 day rolling
    rolling_30d_matches = COALESCE((
      SELECT COUNT(*) FROM match_statistics
      WHERE player_id = p_player_id AND created_at > NOW() - INTERVAL '30 days'
    ), 0),
    rolling_30d_wins = COALESCE((
      SELECT COUNT(*) FROM match_statistics
      WHERE player_id = p_player_id AND won = true AND created_at > NOW() - INTERVAL '30 days'
    ), 0),
    rolling_30d_average = COALESCE((
      SELECT AVG(three_dart_average) FROM leg_statistics
      WHERE player_id = p_player_id AND created_at > NOW() - INTERVAL '30 days'
    ), 0),

    -- 7 day rolling
    rolling_7d_matches = COALESCE((
      SELECT COUNT(*) FROM match_statistics
      WHERE player_id = p_player_id AND created_at > NOW() - INTERVAL '7 days'
    ), 0),
    rolling_7d_wins = COALESCE((
      SELECT COUNT(*) FROM match_statistics
      WHERE player_id = p_player_id AND won = true AND created_at > NOW() - INTERVAL '7 days'
    ), 0),
    rolling_7d_average = COALESCE((
      SELECT AVG(three_dart_average) FROM leg_statistics
      WHERE player_id = p_player_id AND created_at > NOW() - INTERVAL '7 days'
    ), 0),

    total_180s_milestone = COALESCE((
      SELECT SUM(visits_180) FROM leg_statistics WHERE player_id = p_player_id
    ), 0),
    total_100plus_checkouts = COALESCE((
      SELECT COUNT(*) FROM checkout_attempts 
      WHERE player_id = p_player_id AND was_successful = true AND checkout_value >= 100
    ), 0),

    last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE player_id = p_player_id;
  
  -- Also update user_profile stats
  UPDATE user_profile
  SET
    total_games_played = v_lifetime_matches,
    total_wins = v_lifetime_wins,
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
