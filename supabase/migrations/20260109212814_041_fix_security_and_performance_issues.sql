/*
  # Fix Security and Performance Issues

  1. Add Missing Indexes
    - Add index for pvp_challenges.lobby_id
    - Add index for pvp_challenges.room_id
  
  2. Fix RLS Policies
    - Optimize all RLS policies to use (select auth.uid()) instead of auth.uid()
    - This prevents re-evaluation for each row, improving performance
    - Fix duplicate policies on game_invites
  
  3. Fix Function Security
    - Set search_path for friend management functions to prevent security issues
  
  4. Security
    - All changes maintain existing security guarantees
    - Performance improvements through better query planning
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_pvp_challenges_lobby_id ON pvp_challenges(lobby_id);
CREATE INDEX IF NOT EXISTS idx_pvp_challenges_room_id ON pvp_challenges(room_id);

-- Drop and recreate game_invites policies with optimization and fix duplicates
DROP POLICY IF EXISTS "Users can view relevant invites" ON game_invites;
DROP POLICY IF EXISTS "Users can view their invites" ON game_invites;

CREATE POLICY "Users can view relevant invites"
  ON game_invites FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = inviter_id OR (select auth.uid()) = invitee_id);

-- Fix pvp_lobby policies
DROP POLICY IF EXISTS "Users can view active lobby entries" ON pvp_lobby;
DROP POLICY IF EXISTS "Users can create own lobby entries" ON pvp_lobby;
DROP POLICY IF EXISTS "Users can update own lobby entries" ON pvp_lobby;
DROP POLICY IF EXISTS "Users can delete own lobby entries" ON pvp_lobby;

CREATE POLICY "Users can view active lobby entries"
  ON pvp_lobby FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can create own lobby entries"
  ON pvp_lobby FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own lobby entries"
  ON pvp_lobby FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own lobby entries"
  ON pvp_lobby FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Fix pvp_challenges policies
DROP POLICY IF EXISTS "Users can view relevant challenges" ON pvp_challenges;
DROP POLICY IF EXISTS "Users can create challenges" ON pvp_challenges;
DROP POLICY IF EXISTS "Challenge recipients can update" ON pvp_challenges;
DROP POLICY IF EXISTS "Users can delete own challenges" ON pvp_challenges;

CREATE POLICY "Users can view relevant challenges"
  ON pvp_challenges FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = challenger_id OR (select auth.uid()) = opponent_id);

CREATE POLICY "Users can create challenges"
  ON pvp_challenges FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = challenger_id);

CREATE POLICY "Challenge recipients can update"
  ON pvp_challenges FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = opponent_id)
  WITH CHECK ((select auth.uid()) = opponent_id);

CREATE POLICY "Users can delete own challenges"
  ON pvp_challenges FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = challenger_id);

-- Fix blocked_users policies
DROP POLICY IF EXISTS "Users can view own blocked users" ON blocked_users;
DROP POLICY IF EXISTS "Users can block users" ON blocked_users;
DROP POLICY IF EXISTS "Users can unblock users" ON blocked_users;

CREATE POLICY "Users can view own blocked users"
  ON blocked_users FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can block users"
  ON blocked_users FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can unblock users"
  ON blocked_users FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Fix function security by setting search_path
CREATE OR REPLACE FUNCTION reject_friend_request(request_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  req friend_requests;
BEGIN
  SELECT * INTO req FROM friend_requests WHERE id = request_id AND to_user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
  
  IF req.status != 'pending' THEN
    RAISE EXCEPTION 'Friend request already processed';
  END IF;
  
  UPDATE friend_requests SET status = 'rejected', updated_at = now() WHERE id = request_id;
END;
$$;

CREATE OR REPLACE FUNCTION remove_friend(friend_user_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM friendships 
  WHERE (user_id = auth.uid() AND friend_id = friend_user_id)
     OR (user_id = friend_user_id AND friend_id = auth.uid());
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION block_user(blocked_user_id uuid, block_reason text DEFAULT NULL)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF blocked_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot block yourself';
  END IF;
  
  DELETE FROM friendships 
  WHERE (user_id = auth.uid() AND friend_id = blocked_user_id)
     OR (user_id = blocked_user_id AND friend_id = auth.uid());
  
  DELETE FROM friend_requests
  WHERE (from_user_id = auth.uid() AND to_user_id = blocked_user_id)
     OR (from_user_id = blocked_user_id AND to_user_id = auth.uid());
  
  INSERT INTO blocked_users (user_id, blocked_user_id, reason)
  VALUES (auth.uid(), blocked_user_id, block_reason)
  ON CONFLICT (user_id, blocked_user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION unblock_user(blocked_user_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM blocked_users 
  WHERE user_id = auth.uid() AND blocked_user_id = blocked_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is not blocked';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION get_friend_status(other_user_id uuid)
RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
  is_friend boolean;
  has_pending_request boolean;
  sent_request boolean;
  is_blocked boolean;
  is_blocking boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM blocked_users 
    WHERE user_id = auth.uid() AND blocked_user_id = other_user_id
  ) INTO is_blocking;
  
  SELECT EXISTS(
    SELECT 1 FROM blocked_users 
    WHERE user_id = other_user_id AND blocked_user_id = auth.uid()
  ) INTO is_blocked;
  
  SELECT EXISTS(
    SELECT 1 FROM friendships 
    WHERE user_id = auth.uid() AND friend_id = other_user_id
  ) INTO is_friend;
  
  SELECT EXISTS(
    SELECT 1 FROM friend_requests 
    WHERE from_user_id = other_user_id 
      AND to_user_id = auth.uid() 
      AND status = 'pending'
  ) INTO has_pending_request;
  
  SELECT EXISTS(
    SELECT 1 FROM friend_requests 
    WHERE from_user_id = auth.uid() 
      AND to_user_id = other_user_id 
      AND status = 'pending'
  ) INTO sent_request;
  
  result := jsonb_build_object(
    'is_friend', is_friend,
    'has_pending_request', has_pending_request,
    'sent_request', sent_request,
    'is_blocked', is_blocked,
    'is_blocking', is_blocking
  );
  
  RETURN result;
END;
$$;
