/*
  # Save, Resume, and Surrender Game Functions

  1. New Functions
    - `surrender_game(p_game_id uuid)` - Player surrenders, opponent wins
    - `save_and_pause_game(p_game_id uuid, p_game_state jsonb)` - Save game state and pause
    - `resume_game(p_game_id uuid)` - Resume a paused game
    - `get_paused_games(p_user_id uuid)` - Get all paused games for a user

  2. Changes
    - Adds complete game state management for paused games
    - Handles win/loss statistics when surrendering
    - Enables notification system for game resumption

  3. Security
    - All functions validate user participation in game
    - Only active/paused games can be modified
    - Statistics are properly tracked for surrenders
*/

-- Function to surrender a game (player gives up, opponent wins)
CREATE OR REPLACE FUNCTION surrender_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_game RECORD;
  v_opponent_id uuid;
  v_surrendering_player RECORD;
  v_opponent_player RECORD;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get game details
  SELECT g.*, g.game_mode, g.status
  INTO v_game
  FROM online_games g
  WHERE g.id = p_game_id
    AND g.status IN ('active', 'paused');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found or already completed');
  END IF;

  -- Find surrendering player and opponent
  SELECT * INTO v_surrendering_player
  FROM game_players
  WHERE game_id = p_game_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not in this game');
  END IF;

  -- Find opponent
  SELECT * INTO v_opponent_player
  FROM game_players
  WHERE game_id = p_game_id AND user_id != v_user_id;

  v_opponent_id := v_opponent_player.user_id;

  -- Update game status
  UPDATE online_games
  SET 
    status = 'completed',
    winner_id = v_opponent_id,
    completed_at = now(),
    updated_at = now()
  WHERE id = p_game_id;

  -- Update game players - surrendering player loses
  UPDATE game_players
  SET 
    is_winner = false,
    final_score = COALESCE((game_state->>'score')::int, 0),
    updated_at = now()
  WHERE game_id = p_game_id AND user_id = v_user_id;

  -- Update game players - opponent wins
  UPDATE game_players
  SET 
    is_winner = true,
    final_score = COALESCE((game_state->>'score')::int, 0),
    updated_at = now()
  WHERE game_id = p_game_id AND user_id = v_opponent_id;

  -- Update statistics for surrendering player (loss)
  PERFORM update_game_statistics(
    v_user_id,
    p_game_id,
    v_game.game_mode,
    false, -- is_winner
    COALESCE((v_surrendering_player.game_state->>'score')::int, 0),
    0, -- darts_thrown
    0, -- avg_score
    false, -- is_bot
    v_opponent_id
  );

  -- Update statistics for opponent (win)
  PERFORM update_game_statistics(
    v_opponent_id,
    p_game_id,
    v_game.game_mode,
    true, -- is_winner
    COALESCE((v_opponent_player.game_state->>'score')::int, 0),
    0, -- darts_thrown
    0, -- avg_score
    false, -- is_bot
    v_user_id
  );

  -- Send notification to opponent
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    v_opponent_id,
    'game_completed',
    'Victory!',
    'Your opponent surrendered. You won the game!',
    jsonb_build_object('game_id', p_game_id, 'reason', 'surrender')
  );

  RETURN jsonb_build_object(
    'success', true,
    'game_id', p_game_id,
    'winner_id', v_opponent_id,
    'message', 'Game surrendered successfully'
  );
END;
$$;

-- Function to save and pause a game
CREATE OR REPLACE FUNCTION save_and_pause_game(
  p_game_id uuid,
  p_game_state jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_game RECORD;
  v_opponent_id uuid;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get game details
  SELECT g.*
  INTO v_game
  FROM online_games g
  WHERE g.id = p_game_id
    AND g.status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found or not active');
  END IF;

  -- Verify user is in this game
  IF NOT EXISTS (
    SELECT 1 FROM game_players
    WHERE game_id = p_game_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not in this game');
  END IF;

  -- Get opponent
  SELECT user_id INTO v_opponent_id
  FROM game_players
  WHERE game_id = p_game_id AND user_id != v_user_id;

  -- Update game status to paused
  UPDATE online_games
  SET 
    status = 'paused',
    game_state = p_game_state,
    paused_at = now(),
    paused_by = v_user_id,
    updated_at = now()
  WHERE id = p_game_id;

  -- Send notification to opponent
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    v_opponent_id,
    'game_paused',
    'Game Paused',
    'Your opponent paused the game. You can resume it later.',
    jsonb_build_object('game_id', p_game_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'game_id', p_game_id,
    'message', 'Game saved and paused successfully'
  );
END;
$$;

-- Function to resume a paused game
CREATE OR REPLACE FUNCTION resume_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_game RECORD;
  v_opponent_id uuid;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get game details
  SELECT g.*
  INTO v_game
  FROM online_games g
  WHERE g.id = p_game_id
    AND g.status = 'paused';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found or not paused');
  END IF;

  -- Verify user is in this game
  IF NOT EXISTS (
    SELECT 1 FROM game_players
    WHERE game_id = p_game_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not in this game');
  END IF;

  -- Get opponent
  SELECT user_id INTO v_opponent_id
  FROM game_players
  WHERE game_id = p_game_id AND user_id != v_user_id;

  -- Update game status to active
  UPDATE online_games
  SET 
    status = 'active',
    paused_at = NULL,
    paused_by = NULL,
    updated_at = now()
  WHERE id = p_game_id;

  -- Send notification to opponent
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    v_opponent_id,
    'game_resumed',
    'Game Resumed',
    'Your opponent is back! The game has been resumed.',
    jsonb_build_object('game_id', p_game_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'game_id', p_game_id,
    'game_state', v_game.game_state,
    'message', 'Game resumed successfully'
  );
END;
$$;

-- Function to get all paused games for a user
CREATE OR REPLACE FUNCTION get_paused_games(p_user_id uuid)
RETURNS TABLE (
  game_id uuid,
  game_mode text,
  opponent_id uuid,
  opponent_name text,
  opponent_avatar text,
  paused_at timestamptz,
  paused_by uuid,
  paused_by_me boolean,
  game_state jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id as game_id,
    g.game_mode,
    gp_opponent.user_id as opponent_id,
    up_opponent.display_name as opponent_name,
    up_opponent.avatar_url as opponent_avatar,
    g.paused_at,
    g.paused_by,
    (g.paused_by = p_user_id) as paused_by_me,
    g.game_state
  FROM online_games g
  INNER JOIN game_players gp_user ON g.id = gp_user.game_id AND gp_user.user_id = p_user_id
  INNER JOIN game_players gp_opponent ON g.id = gp_opponent.game_id AND gp_opponent.user_id != p_user_id
  INNER JOIN user_profiles up_opponent ON gp_opponent.user_id = up_opponent.user_id
  WHERE g.status = 'paused'
  ORDER BY g.paused_at DESC;
END;
$$;