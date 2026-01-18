/*
  # Allow Surrender and Save for Abandoned Games

  1. Changes
    - Update surrender_game to accept 'abandoned' games
    - Update save_and_pause_game to accept 'abandoned' games
    - These games can still be played, they're just marked abandoned due to inactivity

  2. Notes
    - Games marked as 'abandoned' by the auto-abandon system can still be in active play
    - Users should be able to surrender or save these games
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

  -- Get game details from game_rooms (accept any status except completed/forfeited)
  SELECT *
  INTO v_game
  FROM game_rooms
  WHERE id = p_game_id
    AND status NOT IN ('completed', 'forfeited');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found or already completed');
  END IF;

  -- Find surrendering player and opponent
  SELECT * INTO v_surrendering_player
  FROM game_players
  WHERE room_id = p_game_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not in this game');
  END IF;

  -- Find opponent
  SELECT * INTO v_opponent_player
  FROM game_players
  WHERE room_id = p_game_id AND user_id != v_user_id AND user_id IS NOT NULL;

  v_opponent_id := v_opponent_player.user_id;

  -- Update game status
  UPDATE game_rooms
  SET 
    status = 'forfeited',
    winner_id = v_opponent_id,
    win_type = 'surrender',
    completed_at = now()
  WHERE id = p_game_id;

  -- Send notification to opponent if exists
  IF v_opponent_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_opponent_id,
      'game_completed',
      'Győzelem!',
      'Az ellenfeled feladta a játékot. Nyertél!',
      jsonb_build_object('game_id', p_game_id, 'reason', 'surrender')
    );
  END IF;

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

  -- Get game details from game_rooms (accept any status except completed/forfeited)
  SELECT *
  INTO v_game
  FROM game_rooms
  WHERE id = p_game_id
    AND status NOT IN ('completed', 'forfeited');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found or not active');
  END IF;

  -- Verify user is in this game
  IF NOT EXISTS (
    SELECT 1 FROM game_players
    WHERE room_id = p_game_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not in this game');
  END IF;

  -- Get opponent
  SELECT user_id INTO v_opponent_id
  FROM game_players
  WHERE room_id = p_game_id AND user_id != v_user_id AND user_id IS NOT NULL;

  -- Update game status to paused
  UPDATE game_rooms
  SET 
    status = 'paused_mutual',
    paused_at = now(),
    pause_reason = 'player_request'
  WHERE id = p_game_id;

  -- Update game state
  UPDATE game_state
  SET
    turn_darts = COALESCE((p_game_state->>'turn_darts')::jsonb, '[]'::jsonb),
    updated_at = now()
  WHERE room_id = p_game_id;

  -- Update player scores from saved state
  IF p_game_state ? 'players' THEN
    UPDATE game_players gp
    SET
      current_score = (player_data->>'current_score')::int,
      legs_won = (player_data->>'legs_won')::int,
      sets_won = (player_data->>'sets_won')::int
    FROM jsonb_array_elements(p_game_state->'players') AS player_data
    WHERE gp.room_id = p_game_id
      AND gp.id = (player_data->>'id')::uuid;
  END IF;

  -- Send notification to opponent if exists
  IF v_opponent_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_opponent_id,
      'game_paused',
      'Játék szüneteltetve',
      'Az ellenfeled szüneteltette a játékot. Később folytathatod.',
      jsonb_build_object('game_id', p_game_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'game_id', p_game_id,
    'message', 'Game saved and paused successfully'
  );
END;
$$;