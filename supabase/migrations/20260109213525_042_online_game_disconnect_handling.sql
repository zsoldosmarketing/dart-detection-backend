/*
  # Online Game Disconnect & Reconnection Handling

  1. New Columns
    - game_rooms:
      - `paused_at` - When game was paused
      - `pause_reason` - Why game is paused (disconnect, mutual, timeout)
      - `resume_deadline` - When game will be auto-abandoned if not resumed
      - `win_type` - How game was won (normal, forfeit, technical, mutual_cancel)
    
    - game_players:
      - `disconnect_count` - Number of disconnections in this game
      - `total_disconnect_time` - Total time spent disconnected
      - `can_reconnect_until` - Deadline for reconnection
  
  2. New Tables
    - `game_pause_requests` - Pause requests between players
    - `game_connection_log` - Track connection history for debugging
  
  3. New Functions
    - `handle_player_disconnect()` - Called when player disconnects
    - `handle_player_reconnect()` - Called when player reconnects
    - `check_game_timeouts()` - Check for timed out games
    - `request_pause()` - Request game pause
    - `respond_to_pause()` - Accept/decline pause request
  
  4. Security
    - Enable RLS on new tables
    - Functions use SECURITY DEFINER for safe state updates
*/

-- Add new columns to game_rooms
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_rooms' AND column_name = 'paused_at') THEN
    ALTER TABLE game_rooms ADD COLUMN paused_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_rooms' AND column_name = 'pause_reason') THEN
    ALTER TABLE game_rooms ADD COLUMN pause_reason text CHECK (pause_reason IN ('disconnect', 'mutual', 'timeout', 'system'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_rooms' AND column_name = 'resume_deadline') THEN
    ALTER TABLE game_rooms ADD COLUMN resume_deadline timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_rooms' AND column_name = 'win_type') THEN
    ALTER TABLE game_rooms ADD COLUMN win_type text CHECK (win_type IN ('normal', 'forfeit', 'technical', 'mutual_cancel'));
  END IF;
END $$;

-- Update game_rooms status check to include new statuses
DO $$
BEGIN
  ALTER TABLE game_rooms DROP CONSTRAINT IF EXISTS game_rooms_status_check;
  ALTER TABLE game_rooms ADD CONSTRAINT game_rooms_status_check 
    CHECK (status IN ('waiting', 'in_progress', 'paused_disconnect', 'paused_mutual', 'completed', 'abandoned', 'forfeited'));
END $$;

-- Add new columns to game_players
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_players' AND column_name = 'disconnect_count') THEN
    ALTER TABLE game_players ADD COLUMN disconnect_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_players' AND column_name = 'total_disconnect_time') THEN
    ALTER TABLE game_players ADD COLUMN total_disconnect_time interval DEFAULT '0 seconds'::interval;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_players' AND column_name = 'can_reconnect_until') THEN
    ALTER TABLE game_players ADD COLUMN can_reconnect_until timestamptz;
  END IF;
END $$;

-- Game pause requests table
CREATE TABLE IF NOT EXISTS game_pause_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  pause_duration_minutes integer NOT NULL DEFAULT 5 CHECK (pause_duration_minutes BETWEEN 1 AND 10),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 seconds'),
  responded_at timestamptz
);

ALTER TABLE game_pause_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view pause requests for their games"
  ON game_pause_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players 
      WHERE game_players.room_id = game_pause_requests.room_id 
      AND game_players.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Players can create pause requests"
  ON game_pause_requests FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = requester_id);

CREATE POLICY "Players can update pause requests"
  ON game_pause_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM game_players 
      WHERE game_players.room_id = game_pause_requests.room_id 
      AND game_players.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_players 
      WHERE game_players.room_id = game_pause_requests.room_id 
      AND game_players.user_id = (select auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_pause_requests_room ON game_pause_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_pause_requests_status ON game_pause_requests(status) WHERE status = 'pending';

-- Game connection log for debugging
CREATE TABLE IF NOT EXISTS game_connection_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('connect', 'disconnect', 'ping', 'reconnect', 'timeout')),
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE game_connection_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own connection logs"
  ON game_connection_log FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_connection_log_room ON game_connection_log(room_id);
CREATE INDEX IF NOT EXISTS idx_connection_log_user ON game_connection_log(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_log_created ON game_connection_log(created_at);

-- Function to handle player disconnect
CREATE OR REPLACE FUNCTION handle_player_disconnect(p_room_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_disconnect_count integer;
  v_result jsonb;
BEGIN
  -- Update player status
  UPDATE game_players
  SET 
    is_connected = false,
    disconnect_count = disconnect_count + 1,
    can_reconnect_until = now() + interval '10 minutes'
  WHERE room_id = p_room_id AND user_id = p_user_id
  RETURNING disconnect_count INTO v_disconnect_count;
  
  -- Log the disconnect
  INSERT INTO game_connection_log (room_id, user_id, event_type, metadata)
  VALUES (p_room_id, p_user_id, 'disconnect', jsonb_build_object('disconnect_count', v_disconnect_count));
  
  -- Pause game if it was in progress
  UPDATE game_rooms
  SET 
    status = 'paused_disconnect',
    paused_at = now(),
    pause_reason = 'disconnect',
    resume_deadline = now() + interval '10 minutes'
  WHERE id = p_room_id AND status = 'in_progress';
  
  -- Check if too many disconnects (3 strikes rule)
  IF v_disconnect_count >= 3 THEN
    -- Auto-forfeit after 3 disconnects
    UPDATE game_rooms
    SET 
      status = 'forfeited',
      completed_at = now(),
      win_type = 'technical',
      winner_id = (
        SELECT user_id FROM game_players 
        WHERE room_id = p_room_id AND user_id != p_user_id 
        LIMIT 1
      )
    WHERE id = p_room_id;
    
    v_result := jsonb_build_object(
      'action', 'auto_forfeit',
      'reason', 'too_many_disconnects',
      'disconnect_count', v_disconnect_count
    );
  ELSE
    v_result := jsonb_build_object(
      'action', 'paused',
      'disconnect_count', v_disconnect_count,
      'can_reconnect_until', (now() + interval '10 minutes')
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Function to handle player reconnect
CREATE OR REPLACE FUNCTION handle_player_reconnect(p_room_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_disconnect_duration interval;
  v_other_player_connected boolean;
  v_result jsonb;
BEGIN
  -- Calculate disconnect duration
  SELECT now() - last_ping_at INTO v_disconnect_duration
  FROM game_players
  WHERE room_id = p_room_id AND user_id = p_user_id;
  
  -- Update player status
  UPDATE game_players
  SET 
    is_connected = true,
    last_ping_at = now(),
    total_disconnect_time = total_disconnect_time + COALESCE(v_disconnect_duration, interval '0'),
    can_reconnect_until = NULL
  WHERE room_id = p_room_id AND user_id = p_user_id;
  
  -- Log the reconnect
  INSERT INTO game_connection_log (room_id, user_id, event_type, metadata)
  VALUES (p_room_id, p_user_id, 'reconnect', jsonb_build_object('disconnect_duration', EXTRACT(EPOCH FROM v_disconnect_duration)));
  
  -- Check if other player is connected
  SELECT is_connected INTO v_other_player_connected
  FROM game_players
  WHERE room_id = p_room_id AND user_id != p_user_id
  LIMIT 1;
  
  -- Resume game if both players are connected
  IF v_other_player_connected THEN
    UPDATE game_rooms
    SET 
      status = 'in_progress',
      paused_at = NULL,
      pause_reason = NULL,
      resume_deadline = NULL
    WHERE id = p_room_id AND status IN ('paused_disconnect', 'paused_mutual');
    
    v_result := jsonb_build_object('action', 'resumed', 'game_status', 'in_progress');
  ELSE
    v_result := jsonb_build_object('action', 'waiting', 'waiting_for', 'other_player');
  END IF;
  
  RETURN v_result;
END;
$$;

-- Function to check game timeouts
CREATE OR REPLACE FUNCTION check_game_timeouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Handle games where reconnect deadline passed
  UPDATE game_rooms
  SET 
    status = 'forfeited',
    completed_at = now(),
    win_type = 'technical',
    winner_id = (
      SELECT user_id FROM game_players 
      WHERE game_players.room_id = game_rooms.id 
      AND is_connected = true 
      LIMIT 1
    )
  WHERE status IN ('paused_disconnect', 'paused_mutual')
  AND resume_deadline < now()
  AND resume_deadline IS NOT NULL;
  
  -- Abandon games where both players are offline
  UPDATE game_rooms
  SET 
    status = 'abandoned',
    completed_at = now()
  WHERE status IN ('paused_disconnect', 'paused_mutual')
  AND resume_deadline < now()
  AND NOT EXISTS (
    SELECT 1 FROM game_players 
    WHERE game_players.room_id = game_rooms.id 
    AND is_connected = true
  );
END;
$$;

-- Function to request pause
CREATE OR REPLACE FUNCTION request_pause(p_room_id uuid, p_duration_minutes integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request_id uuid;
  v_pause_count integer;
  v_result jsonb;
BEGIN
  -- Check how many pauses this user has requested
  SELECT COUNT(*) INTO v_pause_count
  FROM game_pause_requests
  WHERE room_id = p_room_id 
  AND requester_id = auth.uid()
  AND status = 'accepted';
  
  IF v_pause_count >= 2 THEN
    RETURN jsonb_build_object('error', 'max_pauses_reached', 'message', 'Maximum 2 pauses per player per game');
  END IF;
  
  -- Create pause request
  INSERT INTO game_pause_requests (room_id, requester_id, pause_duration_minutes)
  VALUES (p_room_id, auth.uid(), p_duration_minutes)
  RETURNING id INTO v_request_id;
  
  v_result := jsonb_build_object(
    'request_id', v_request_id,
    'status', 'pending',
    'expires_at', now() + interval '30 seconds'
  );
  
  RETURN v_result;
END;
$$;

-- Function to respond to pause request
CREATE OR REPLACE FUNCTION respond_to_pause(p_request_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request game_pause_requests;
  v_result jsonb;
BEGIN
  -- Get request details
  SELECT * INTO v_request FROM game_pause_requests WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'request_not_found');
  END IF;
  
  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'request_already_processed', 'status', v_request.status);
  END IF;
  
  -- Update request
  UPDATE game_pause_requests
  SET 
    status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
    responded_at = now()
  WHERE id = p_request_id;
  
  IF p_accept THEN
    -- Pause the game
    UPDATE game_rooms
    SET 
      status = 'paused_mutual',
      paused_at = now(),
      pause_reason = 'mutual',
      resume_deadline = now() + (v_request.pause_duration_minutes || ' minutes')::interval
    WHERE id = v_request.room_id;
    
    v_result := jsonb_build_object(
      'action', 'paused',
      'duration_minutes', v_request.pause_duration_minutes,
      'resume_deadline', now() + (v_request.pause_duration_minutes || ' minutes')::interval
    );
  ELSE
    v_result := jsonb_build_object('action', 'declined');
  END IF;
  
  RETURN v_result;
END;
$$;

-- Add new columns to match_statistics for tracking disconnects
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'match_statistics' AND column_name = 'is_completed') THEN
    ALTER TABLE match_statistics ADD COLUMN is_completed boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'match_statistics' AND column_name = 'disconnect_count') THEN
    ALTER TABLE match_statistics ADD COLUMN disconnect_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'match_statistics' AND column_name = 'total_disconnect_time') THEN
    ALTER TABLE match_statistics ADD COLUMN total_disconnect_time interval DEFAULT '0 seconds'::interval;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'match_statistics' AND column_name = 'win_type') THEN
    ALTER TABLE match_statistics ADD COLUMN win_type text;
  END IF;
END $$;
