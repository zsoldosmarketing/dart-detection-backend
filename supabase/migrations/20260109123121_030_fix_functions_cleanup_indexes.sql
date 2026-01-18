/*
  # Fix Function Security and Cleanup Unused Indexes

  ## Security Improvements
  
  1. **Function Search Path Security**
     - Set search_path to pg_catalog, public for SECURITY DEFINER functions
     - Prevents malicious search_path manipulation

  2. **Cleanup**
     - Remove unused indexes that are not providing value
*/

-- ============================================================================
-- PART 1: Fix Function Security (Search Path)
-- ============================================================================

-- Drop and recreate functions with secure search_path
DROP FUNCTION IF EXISTS accept_friend_request(uuid);
CREATE FUNCTION accept_friend_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid;
  v_friend_id uuid;
BEGIN
  SELECT user_id, friend_id INTO v_user_id, v_friend_id
  FROM friendships
  WHERE id = request_id
  AND status = 'pending';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
  
  UPDATE friendships
  SET status = 'accepted', updated_at = now()
  WHERE id = request_id;
END;
$$;

DROP FUNCTION IF EXISTS initialize_player_stats_summary(uuid);
CREATE FUNCTION initialize_player_stats_summary(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO player_statistics_summary (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS update_player_statistics_summary(uuid);
CREATE FUNCTION update_player_statistics_summary(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO player_statistics_summary (player_id)
  VALUES (p_player_id)
  ON CONFLICT (player_id) DO NOTHING;
END;
$$;

-- For trigger functions, we need to alter them
ALTER FUNCTION auto_initialize_stats_summary() SET search_path = pg_catalog, public;

-- ============================================================================
-- PART 2: Remove Unused Indexes (Cleanup)
-- ============================================================================

-- These indexes were created but are not being used according to Supabase analysis
DROP INDEX IF EXISTS idx_dart_throws_player;
DROP INDEX IF EXISTS idx_dart_throws_room;
DROP INDEX IF EXISTS idx_dart_throws_turn;
DROP INDEX IF EXISTS idx_dart_throws_game_type;
DROP INDEX IF EXISTS idx_dart_throws_training;
DROP INDEX IF EXISTS idx_leg_stats_player;
DROP INDEX IF EXISTS idx_leg_stats_room;
DROP INDEX IF EXISTS idx_leg_stats_avg;
DROP INDEX IF EXISTS idx_match_stats_player;
DROP INDEX IF EXISTS idx_match_stats_opponent;
DROP INDEX IF EXISTS idx_match_stats_won;
DROP INDEX IF EXISTS idx_checkout_attempts_player;
DROP INDEX IF EXISTS idx_checkout_attempts_value;
DROP INDEX IF EXISTS idx_checkout_attempts_success;
DROP INDEX IF EXISTS idx_training_drill_stats_player;
DROP INDEX IF EXISTS idx_training_drill_stats_drill;
DROP INDEX IF EXISTS idx_multiplayer_games_game_mode_id;
DROP INDEX IF EXISTS idx_multiplayer_games_winner_user_id;
