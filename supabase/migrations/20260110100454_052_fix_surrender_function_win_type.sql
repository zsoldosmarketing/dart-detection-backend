/*
  # Fix Surrender Function - Correct win_type Value

  1. Changes
    - Update surrender_game to use 'forfeit' instead of 'surrender' for win_type
    - Allowed win_type values: 'normal', 'forfeit', 'technical', 'mutual_cancel'

  2. Notes
    - The function was using 'surrender' which is not in the check constraint
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

  -- Update game status (use 'forfeit' as win_type)
  UPDATE game_rooms
  SET 
    status = 'forfeited',
    winner_id = v_opponent_id,
    win_type = 'forfeit',
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION surrender_game(uuid) TO authenticated;