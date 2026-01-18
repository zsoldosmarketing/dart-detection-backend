/*
  # Cleanup Unused Indexes and Fix Function Security

  1. Remove Unused Indexes
    - Drop indexes that are not being used by queries
    - Reduces storage overhead and improves write performance

  2. Fix Function Security
    - Set proper search_path for functions to prevent security issues
    - Ensures functions execute with predictable schema resolution

  ## Indexes Removed
  - idx_game_pause_requests_requester
  - idx_game_resume_requests_room_id
  - idx_game_resume_requests_requester_id
  - idx_game_resume_requests_opponent_id
  - idx_pvp_challenges_challenge_type
  - idx_game_state_turn_started_at

  ## Functions Fixed
  - update_voice_settings_updated_at
*/

-- =====================================================
-- SECTION 1: Drop Unused Indexes
-- =====================================================

DROP INDEX IF EXISTS idx_game_pause_requests_requester;
DROP INDEX IF EXISTS idx_game_resume_requests_room_id;
DROP INDEX IF EXISTS idx_game_resume_requests_requester_id;
DROP INDEX IF EXISTS idx_game_resume_requests_opponent_id;
DROP INDEX IF EXISTS idx_pvp_challenges_challenge_type;
DROP INDEX IF EXISTS idx_game_state_turn_started_at;

-- =====================================================
-- SECTION 2: Fix Function Security (search_path)
-- =====================================================

CREATE OR REPLACE FUNCTION update_voice_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;