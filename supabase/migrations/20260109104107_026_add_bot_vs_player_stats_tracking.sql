/*
  # Bot vs Player Statistics Tracking

  ## Overview
  Extend statistics system to separately track performance against bots vs human players.

  ## Changes
  
  ### 1. Add columns to player_statistics_summary
  Add separate stat tracking for bot matches vs human matches:
  
  #### Bot Match Stats (All-Time)
  - bot_matches_played
  - bot_matches_won
  - bot_win_percentage
  - bot_average
  - bot_highest_checkout
  
  #### Human Match Stats (All-Time)
  - human_matches_played
  - human_matches_won
  - human_win_percentage
  - human_average
  - human_highest_checkout
  
  #### Local Match Stats (All-Time)
  - local_matches_played
  - local_average
  
  ## Benefits
  - Players can see their performance improvement against different opponent types
  - Bot practice results are separated from competitive PvP results
  - More accurate skill assessment
  
  ## Security
  - Uses existing RLS policies on player_statistics_summary
*/

-- Add bot vs human statistics columns to player_statistics_summary
DO $$
BEGIN
  -- Bot match stats
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_statistics_summary' AND column_name = 'bot_matches_played'
  ) THEN
    ALTER TABLE player_statistics_summary 
    ADD COLUMN bot_matches_played integer DEFAULT 0,
    ADD COLUMN bot_matches_won integer DEFAULT 0,
    ADD COLUMN bot_win_percentage numeric(5,2) DEFAULT 0,
    ADD COLUMN bot_average numeric(6,2) DEFAULT 0,
    ADD COLUMN bot_highest_checkout integer DEFAULT 0;
  END IF;
  
  -- Human match stats
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_statistics_summary' AND column_name = 'human_matches_played'
  ) THEN
    ALTER TABLE player_statistics_summary 
    ADD COLUMN human_matches_played integer DEFAULT 0,
    ADD COLUMN human_matches_won integer DEFAULT 0,
    ADD COLUMN human_win_percentage numeric(5,2) DEFAULT 0,
    ADD COLUMN human_average numeric(6,2) DEFAULT 0,
    ADD COLUMN human_highest_checkout integer DEFAULT 0;
  END IF;
  
  -- Local match stats
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_statistics_summary' AND column_name = 'local_matches_played'
  ) THEN
    ALTER TABLE player_statistics_summary 
    ADD COLUMN local_matches_played integer DEFAULT 0,
    ADD COLUMN local_average numeric(6,2) DEFAULT 0;
  END IF;
END $$;

-- Update the statistics summary function to calculate bot vs human stats
CREATE OR REPLACE FUNCTION update_player_statistics_summary(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Calculate and update all-time stats (existing)
  UPDATE player_statistics_summary
  SET
    lifetime_matches_played = (
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id
    ),
    lifetime_matches_won = (
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND won = true
    ),
    lifetime_average = (
      SELECT AVG(three_dart_average) FROM leg_statistics WHERE player_id = p_player_id
    ),
    lifetime_best_average = (
      SELECT MAX(three_dart_average) FROM leg_statistics WHERE player_id = p_player_id
    ),
    lifetime_180s = (
      SELECT SUM(visits_180) FROM leg_statistics WHERE player_id = p_player_id
    ),
    lifetime_checkouts_hit = (
      SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id AND was_successful = true
    ),
    lifetime_checkout_attempts = (
      SELECT COUNT(*) FROM checkout_attempts WHERE player_id = p_player_id
    ),
    lifetime_highest_checkout = (
      SELECT MAX(checkout_value) FROM checkout_attempts WHERE player_id = p_player_id AND was_successful = true
    ),

    -- Bot match stats
    bot_matches_played = (
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'bot'
    ),
    bot_matches_won = (
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'bot' AND won = true
    ),
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
    human_matches_played = (
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'pvp'
    ),
    human_matches_won = (
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'pvp' AND won = true
    ),
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
    local_matches_played = (
      SELECT COUNT(*) FROM match_statistics WHERE player_id = p_player_id AND game_mode = 'local'
    ),
    local_average = (
      SELECT AVG(ls.three_dart_average)
      FROM leg_statistics ls
      JOIN match_statistics ms ON ls.room_id = ms.room_id
      WHERE ls.player_id = p_player_id AND ms.game_mode = 'local'
    ),

    -- 30 day rolling
    rolling_30d_matches = (
      SELECT COUNT(*) FROM match_statistics
      WHERE player_id = p_player_id AND created_at > NOW() - INTERVAL '30 days'
    ),
    rolling_30d_wins = (
      SELECT COUNT(*) FROM match_statistics
      WHERE player_id = p_player_id AND won = true AND created_at > NOW() - INTERVAL '30 days'
    ),
    rolling_30d_average = (
      SELECT AVG(three_dart_average) FROM leg_statistics
      WHERE player_id = p_player_id AND created_at > NOW() - INTERVAL '30 days'
    ),

    last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE player_id = p_player_id;

  -- Calculate win percentage
  UPDATE player_statistics_summary
  SET lifetime_win_percentage =
    CASE
      WHEN lifetime_matches_played > 0
      THEN (lifetime_matches_won::numeric / lifetime_matches_played::numeric * 100)
      ELSE 0
    END,
    lifetime_checkout_percentage =
    CASE
      WHEN lifetime_checkout_attempts > 0
      THEN (lifetime_checkouts_hit::numeric / lifetime_checkout_attempts::numeric * 100)
      ELSE 0
    END,
    bot_win_percentage =
    CASE
      WHEN bot_matches_played > 0
      THEN (bot_matches_won::numeric / bot_matches_played::numeric * 100)
      ELSE 0
    END,
    human_win_percentage =
    CASE
      WHEN human_matches_played > 0
      THEN (human_matches_won::numeric / human_matches_played::numeric * 100)
      ELSE 0
    END
  WHERE player_id = p_player_id;
END;
$$;