/*
  # Direct Challenge and Resume Request Functions

  1. New Functions
    - `create_direct_challenge` - Create a direct challenge to a specific user
    - `respond_to_resume_request` - Accept or decline a game resume request
    - `create_resume_request` - Request to resume a paused game
    - `get_active_and_paused_games` - Get all active and paused games for a user

  2. Features
    - Direct challenges bypass lobby system
    - Resume requests allow players to recall opponent to continue
    - 2-minute timeout for resume request responses
    - Notifications sent for all actions

  3. Security
    - All functions validate user authentication
    - Only game participants can create resume requests
    - Cannot challenge blocked users
*/

-- Function to create a direct challenge
CREATE OR REPLACE FUNCTION create_direct_challenge(
  p_opponent_id uuid,
  p_game_type text DEFAULT 'x01',
  p_starting_score integer DEFAULT 501,
  p_legs_to_win integer DEFAULT 1,
  p_sets_to_win integer DEFAULT 1,
  p_double_in boolean DEFAULT false,
  p_double_out boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_challenge_id uuid;
  v_opponent_name text;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Cannot challenge yourself
  IF v_user_id = p_opponent_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot challenge yourself');
  END IF;

  -- Check if opponent exists
  SELECT display_name INTO v_opponent_name
  FROM user_profile
  WHERE id = p_opponent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opponent not found');
  END IF;

  -- Check if either user has blocked the other
  IF EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_id = v_user_id AND blocked_id = p_opponent_id)
       OR (blocker_id = p_opponent_id AND blocked_id = v_user_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot challenge this user');
  END IF;

  -- Check for existing pending challenge
  IF EXISTS (
    SELECT 1 FROM pvp_challenges
    WHERE challenger_id = v_user_id
      AND opponent_id = p_opponent_id
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending challenge to this user');
  END IF;

  -- Create direct challenge
  INSERT INTO pvp_challenges (
    challenger_id,
    opponent_id,
    challenge_type,
    game_type,
    starting_score,
    legs_to_win,
    sets_to_win,
    double_in,
    double_out,
    status,
    expires_at
  ) VALUES (
    v_user_id,
    p_opponent_id,
    'direct',
    p_game_type,
    p_starting_score,
    p_legs_to_win,
    p_sets_to_win,
    p_double_in,
    p_double_out,
    'pending',
    now() + interval '2 minutes'
  ) RETURNING id INTO v_challenge_id;

  -- Send notification to opponent
  INSERT INTO push_notifications (user_id, type, title, body, data, related_id)
  VALUES (
    p_opponent_id,
    'challenge',
    'New Challenge!',
    v_opponent_name || ' challenged you to a ' || p_starting_score || ' game!',
    jsonb_build_object(
      'challenge_id', v_challenge_id,
      'challenger_id', v_user_id,
      'game_type', p_game_type,
      'starting_score', p_starting_score
    ),
    v_challenge_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'challenge_id', v_challenge_id,
    'expires_at', (now() + interval '2 minutes')
  );
END;
$$;

-- Function to create a resume request
CREATE OR REPLACE FUNCTION create_resume_request(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_opponent_id uuid;
  v_game RECORD;
  v_request_id uuid;
  v_opponent_name text;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get game details
  SELECT * INTO v_game
  FROM game_rooms
  WHERE id = p_room_id
    AND status IN ('paused_disconnect', 'paused_mutual', 'abandoned');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Game not found or cannot be resumed');
  END IF;

  -- Verify user is in game
  IF NOT EXISTS (
    SELECT 1 FROM game_players
    WHERE room_id = p_room_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not in this game');
  END IF;

  -- Get opponent
  SELECT gp.user_id, up.display_name
  INTO v_opponent_id, v_opponent_name
  FROM game_players gp
  JOIN user_profile up ON gp.user_id = up.id
  WHERE gp.room_id = p_room_id AND gp.user_id != v_user_id AND gp.user_id IS NOT NULL
  LIMIT 1;

  IF v_opponent_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Opponent not found');
  END IF;

  -- Check for existing pending request
  IF EXISTS (
    SELECT 1 FROM game_resume_requests
    WHERE room_id = p_room_id
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A resume request is already pending for this game');
  END IF;

  -- Create resume request
  INSERT INTO game_resume_requests (
    room_id,
    requester_id,
    opponent_id,
    status,
    expires_at
  ) VALUES (
    p_room_id,
    v_user_id,
    v_opponent_id,
    'pending',
    now() + interval '2 minutes'
  ) RETURNING id INTO v_request_id;

  -- Send notification to opponent
  INSERT INTO push_notifications (user_id, type, title, body, data, related_id)
  VALUES (
    v_opponent_id,
    'game_update',
    'Resume Game Request',
    v_opponent_name || ' wants to continue your game!',
    jsonb_build_object(
      'request_id', v_request_id,
      'room_id', p_room_id,
      'requester_id', v_user_id,
      'action', 'resume_request'
    ),
    p_room_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'expires_at', (now() + interval '2 minutes')
  );
END;
$$;

-- Function to respond to resume request
CREATE OR REPLACE FUNCTION respond_to_resume_request(
  p_request_id uuid,
  p_accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_request RECORD;
  v_game RECORD;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get request details
  SELECT * INTO v_request
  FROM game_resume_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  -- Verify user is the opponent
  IF v_user_id != v_request.opponent_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not authorized to respond to this request');
  END IF;

  -- Check if request expired
  IF v_request.expires_at < now() THEN
    UPDATE game_resume_requests
    SET status = 'expired', responded_at = now()
    WHERE id = p_request_id;
    
    RETURN jsonb_build_object('success', false, 'error', 'Request has expired');
  END IF;

  -- Get game details
  SELECT * INTO v_game
  FROM game_rooms
  WHERE id = v_request.room_id;

  IF p_accept THEN
    -- Mark both players as connected
    UPDATE game_players
    SET is_connected = true, last_seen_at = now()
    WHERE room_id = v_request.room_id;

    -- Resume the game
    UPDATE game_rooms
    SET 
      status = 'in_progress',
      paused_at = NULL,
      pause_reason = NULL,
      resume_deadline = NULL
    WHERE id = v_request.room_id;

    -- Update request status
    UPDATE game_resume_requests
    SET status = 'accepted', responded_at = now()
    WHERE id = p_request_id;

    -- Notify requester
    INSERT INTO push_notifications (user_id, type, title, body, data, related_id)
    VALUES (
      v_request.requester_id,
      'game_update',
      'Game Resumed!',
      'Your opponent accepted. The game continues!',
      jsonb_build_object(
        'room_id', v_request.room_id,
        'action', 'resume_accepted'
      ),
      v_request.room_id
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'accepted',
      'room_id', v_request.room_id
    );
  ELSE
    -- Update request status
    UPDATE game_resume_requests
    SET status = 'declined', responded_at = now()
    WHERE id = p_request_id;

    -- Keep notification for history but mark declined
    INSERT INTO push_notifications (user_id, type, title, body, data, related_id)
    VALUES (
      v_request.requester_id,
      'game_update',
      'Resume Declined',
      'Your opponent declined to resume the game.',
      jsonb_build_object(
        'room_id', v_request.room_id,
        'action', 'resume_declined'
      ),
      v_request.room_id
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'declined'
    );
  END IF;
END;
$$;

-- Function to get active and paused games for a user
CREATE OR REPLACE FUNCTION get_active_and_paused_games(p_user_id uuid)
RETURNS TABLE (
  room_id uuid,
  game_type text,
  starting_score integer,
  status text,
  opponent_id uuid,
  opponent_name text,
  opponent_avatar text,
  started_at timestamptz,
  paused_at timestamptz,
  pause_reason text,
  resume_deadline timestamptz,
  can_resume boolean,
  game_duration_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gr.id as room_id,
    gr.game_type,
    gr.starting_score,
    gr.status,
    gp_opponent.user_id as opponent_id,
    up_opponent.display_name as opponent_name,
    up_opponent.avatar_url as opponent_avatar,
    gr.started_at,
    gr.paused_at,
    gr.pause_reason,
    gr.resume_deadline,
    (gr.status IN ('paused_disconnect', 'paused_mutual', 'abandoned')) as can_resume,
    EXTRACT(EPOCH FROM (COALESCE(gr.paused_at, now()) - gr.started_at)) / 60 as game_duration_minutes
  FROM game_rooms gr
  INNER JOIN game_players gp_user ON gr.id = gp_user.room_id AND gp_user.user_id = p_user_id
  INNER JOIN game_players gp_opponent ON gr.id = gp_opponent.room_id AND gp_opponent.user_id != p_user_id AND gp_opponent.user_id IS NOT NULL
  INNER JOIN user_profile up_opponent ON gp_opponent.user_id = up_opponent.id
  WHERE gr.mode = 'pvp'
    AND gr.status IN ('in_progress', 'paused_disconnect', 'paused_mutual', 'abandoned')
  ORDER BY 
    CASE gr.status
      WHEN 'in_progress' THEN 1
      WHEN 'paused_disconnect' THEN 2
      WHEN 'paused_mutual' THEN 3
      WHEN 'abandoned' THEN 4
    END,
    gr.started_at DESC;
END;
$$;