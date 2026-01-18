/*
  # Fix PVP Lobby - Single Active Entry Per User

  1. Changes
    - Add unique constraint: one active lobby per user
    - Add cleanup function for expired lobbies
    - Update RLS policy to show only waiting lobbies from other users
  
  2. Security
    - Users can only see their own lobby or waiting lobbies from others
    - Users cannot create multiple active lobbies
  
  3. Notes
    - Existing duplicate lobbies will be cleaned up
    - Expired lobbies will be automatically marked as expired
*/

-- First, clean up duplicate active lobbies (keep only the newest one per user)
DO $$
DECLARE
  v_user_id uuid;
  v_lobby_to_keep uuid;
BEGIN
  -- For each user with multiple active lobbies
  FOR v_user_id IN 
    SELECT user_id 
    FROM pvp_lobby 
    WHERE status = 'waiting'
    GROUP BY user_id 
    HAVING COUNT(*) > 1
  LOOP
    -- Get the newest lobby to keep
    SELECT id INTO v_lobby_to_keep
    FROM pvp_lobby
    WHERE user_id = v_user_id AND status = 'waiting'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Cancel all other lobbies for this user
    UPDATE pvp_lobby
    SET status = 'cancelled'
    WHERE user_id = v_user_id 
      AND status = 'waiting' 
      AND id != v_lobby_to_keep;
  END LOOP;
END $$;

-- Add unique constraint: only one waiting lobby per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_pvp_lobby_one_active_per_user 
  ON pvp_lobby(user_id) 
  WHERE status = 'waiting';

-- Function to cleanup expired lobby entries
CREATE OR REPLACE FUNCTION cleanup_expired_pvp_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark expired lobbies
  UPDATE pvp_lobby
  SET status = 'expired'
  WHERE status = 'waiting' 
    AND expires_at < now();
  
  -- Mark expired challenges
  UPDATE pvp_challenges
  SET status = 'expired'
  WHERE status = 'pending' 
    AND expires_at < now();
  
  -- Mark expired game invites
  UPDATE game_invites
  SET status = 'expired'
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_expired_pvp_entries() TO authenticated;

-- Update RLS policy to exclude own lobby from browse list
DROP POLICY IF EXISTS "Users can view active lobby entries" ON pvp_lobby;

CREATE POLICY "Users can view active lobby entries"
  ON pvp_lobby FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    (status = 'waiting' AND user_id != auth.uid())
  );