/*
  # Update Disconnect Timeout to 3 Minutes

  1. Changes
    - Modify handle_player_disconnect function to use 3-minute timeout instead of 10 minutes
    - This gives players a reasonable but not excessive time to reconnect
    - After 3 minutes, the game is forfeited to the remaining player

  2. Notes
    - More aggressive timeout encourages active play
    - Still reasonable for temporary connection issues
    - Aligns with user request for max 3-minute wait time
*/

CREATE OR REPLACE FUNCTION handle_player_disconnect(
  p_room_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game RECORD;
  v_opponent_id uuid;
  v_disconnect_count integer;
BEGIN
  -- Get game details
  SELECT * INTO v_game
  FROM game_rooms
  WHERE id = p_room_id AND status = 'in_progress';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found or not in progress');
  END IF;
  
  -- Verify user is in game
  IF NOT EXISTS (
    SELECT 1 FROM game_players
    WHERE room_id = p_room_id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not in game');
  END IF;
  
  -- Get opponent
  SELECT user_id INTO v_opponent_id
  FROM game_players
  WHERE room_id = p_room_id AND user_id != p_user_id AND user_id IS NOT NULL
  LIMIT 1;
  
  -- Update player connection status
  UPDATE game_players
  SET 
    is_connected = false,
    last_seen_at = now(),
    disconnect_count = COALESCE(disconnect_count, 0) + 1
  WHERE room_id = p_room_id AND user_id = p_user_id
  RETURNING disconnect_count INTO v_disconnect_count;
  
  -- Log disconnect event
  INSERT INTO game_events (room_id, user_id, event_type, event_data)
  VALUES (p_room_id, p_user_id, 'disconnect', jsonb_build_object('disconnect_count', v_disconnect_count));
  
  -- Pause game if it was in progress - 3 MINUTE TIMEOUT
  UPDATE game_rooms
  SET 
    status = 'paused_disconnect',
    paused_at = now(),
    pause_reason = 'disconnect',
    resume_deadline = now() + interval '3 minutes'
  WHERE id = p_room_id AND status = 'in_progress';
  
  -- Notify opponent
  IF v_opponent_id IS NOT NULL THEN
    INSERT INTO push_notifications (user_id, type, title, body, data, related_id)
    VALUES (
      v_opponent_id,
      'game_update',
      'Opponent Disconnected',
      'Your opponent disconnected. The game is paused for up to 3 minutes.',
      jsonb_build_object(
        'room_id', p_room_id,
        'action', 'opponent_disconnected',
        'timeout_minutes', 3
      ),
      p_room_id
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'status', 'paused_disconnect',
    'resume_deadline', (now() + interval '3 minutes'),
    'timeout_minutes', 3
  );
END;
$$;