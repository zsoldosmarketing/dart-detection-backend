/*
  # Fix Statistics Tracking

  ## Issues Fixed
  
  1. **update_player_statistics_summary Function**
     - Migration 030 accidentally broke this function
     - Restore full functionality to calculate player stats
     - Updates player_statistics_summary table with aggregated data
  
  2. **user_metrics_daily Updates**
     - Create trigger to automatically update daily metrics
     - Aggregate data from dart_throws, leg_statistics, match_statistics
     - Enable real-time statistics display in the app
  
  ## Changes
  - Restore update_player_statistics_summary to full version
  - Create update_user_metrics_daily function
  - Create trigger on match_statistics to update metrics
*/

-- ============================================================================
-- PART 1: Restore update_player_statistics_summary Function
-- ============================================================================

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

    -- PvP match stats
    pvp_matches_played = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'pvp'
    ), 0),
    pvp_matches_won = COALESCE((
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'pvp' AND won = true
    ), 0),
    pvp_average = (
      SELECT AVG(ls.three_dart_average)
      FROM leg_statistics ls
      JOIN match_statistics ms ON ls.room_id = ms.room_id
      WHERE ls.player_id = p_player_id AND ms.game_mode = 'pvp'
    ),
    pvp_highest_checkout = (
      SELECT MAX(ca.checkout_value)
      FROM checkout_attempts ca
      JOIN match_statistics ms ON ca.room_id = ms.room_id
      WHERE ca.player_id = p_player_id AND ms.game_mode = 'pvp' AND ca.was_successful = true
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

-- ============================================================================
-- PART 2: Create user_metrics_daily Update Function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_metrics_daily(p_player_id uuid, p_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO user_metrics_daily (
    user_id,
    date,
    total_darts,
    total_score,
    doubles_attempted,
    doubles_hit,
    triples_attempted,
    triples_hit,
    bulls_attempted,
    bulls_hit,
    checkouts_attempted,
    checkouts_hit,
    highest_checkout,
    training_minutes,
    games_played,
    games_won
  )
  SELECT
    p_player_id,
    p_date,
    COALESCE(SUM(dt.total_darts), 0),
    COALESCE(SUM(dt.total_score), 0),
    COALESCE(SUM(dt.doubles_thrown), 0),
    COALESCE(SUM(dt.doubles_hit), 0),
    COALESCE(SUM(dt.triples_thrown), 0),
    COALESCE(SUM(dt.triples_hit), 0),
    0, -- bulls_attempted (calculate from dart_throws if needed)
    0, -- bulls_hit
    COALESCE((SELECT COUNT(*) FROM checkout_attempts ca WHERE ca.player_id = p_player_id AND DATE(ca.created_at) = p_date), 0),
    COALESCE((SELECT COUNT(*) FROM checkout_attempts ca WHERE ca.player_id = p_player_id AND ca.was_successful = true AND DATE(ca.created_at) = p_date), 0),
    COALESCE((SELECT MAX(ca.checkout_value) FROM checkout_attempts ca WHERE ca.player_id = p_player_id AND ca.was_successful = true AND DATE(ca.created_at) = p_date), 0),
    0, -- training_minutes
    COALESCE((SELECT COUNT(*) FROM match_statistics ms WHERE ms.player_id = p_player_id AND DATE(ms.created_at) = p_date), 0),
    COALESCE((SELECT COUNT(*) FROM match_statistics ms WHERE ms.player_id = p_player_id AND ms.won = true AND DATE(ms.created_at) = p_date), 0)
  FROM (
    SELECT 
      player_id,
      SUM(total_darts) as total_darts,
      SUM(total_score) as total_score,
      SUM(doubles_thrown) as doubles_thrown,
      SUM(doubles_hit) as doubles_hit,
      SUM(triples_thrown) as triples_thrown,
      SUM(triples_hit) as triples_hit
    FROM leg_statistics
    WHERE player_id = p_player_id AND DATE(created_at) = p_date
    GROUP BY player_id
  ) dt
  ON CONFLICT (user_id, date) DO UPDATE SET
    total_darts = EXCLUDED.total_darts,
    total_score = EXCLUDED.total_score,
    doubles_attempted = EXCLUDED.doubles_attempted,
    doubles_hit = EXCLUDED.doubles_hit,
    triples_attempted = EXCLUDED.triples_attempted,
    triples_hit = EXCLUDED.triples_hit,
    bulls_attempted = EXCLUDED.bulls_attempted,
    bulls_hit = EXCLUDED.bulls_hit,
    checkouts_attempted = EXCLUDED.checkouts_attempted,
    checkouts_hit = EXCLUDED.checkouts_hit,
    highest_checkout = EXCLUDED.highest_checkout,
    training_minutes = EXCLUDED.training_minutes,
    games_played = EXCLUDED.games_played,
    games_won = EXCLUDED.games_won,
    updated_at = NOW();
END;
$$;

-- ============================================================================
-- PART 3: Create Trigger to Auto-Update Metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_user_metrics_daily()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Update metrics for the player
  PERFORM update_user_metrics_daily(NEW.player_id, DATE(NEW.created_at));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_statistics_update_metrics ON match_statistics;
CREATE TRIGGER match_statistics_update_metrics
  AFTER INSERT ON match_statistics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_user_metrics_daily();

DROP TRIGGER IF EXISTS leg_statistics_update_metrics ON leg_statistics;
CREATE TRIGGER leg_statistics_update_metrics
  AFTER INSERT ON leg_statistics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_user_metrics_daily();
