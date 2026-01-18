/*
  # Blocked Users and Enhanced Friend Functions

  1. New Tables
    - `blocked_users`
      - `id` (uuid, primary key)
      - `user_id` (uuid, reference to user_profile) - user who blocked
      - `blocked_user_id` (uuid, reference to user_profile) - blocked user
      - `created_at` (timestamptz)
      - `reason` (text, optional)
  
  2. New Functions
    - `reject_friend_request(request_id)` - Reject a friend request
    - `remove_friend(friend_user_id)` - Remove a friend connection
    - `block_user(blocked_user_id, reason)` - Block a user
    - `unblock_user(blocked_user_id)` - Unblock a user
    - `get_friend_status(other_user_id)` - Check friendship status with another user
  
  3. Security
    - Enable RLS on blocked_users table
    - Add policies for authenticated users
    - Prevent blocked users from sending friend requests
*/

CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, blocked_user_id),
  CHECK (user_id != blocked_user_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blocked users"
  ON blocked_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can block users"
  ON blocked_users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unblock users"
  ON blocked_users FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user_id ON blocked_users(blocked_user_id);

-- Reject friend request function
CREATE OR REPLACE FUNCTION reject_friend_request(request_id uuid)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove friend function
CREATE OR REPLACE FUNCTION remove_friend(friend_user_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM friendships 
  WHERE (user_id = auth.uid() AND friend_id = friend_user_id)
     OR (user_id = friend_user_id AND friend_id = auth.uid());
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Block user function
CREATE OR REPLACE FUNCTION block_user(blocked_user_id uuid, block_reason text DEFAULT NULL)
RETURNS void AS $$
BEGIN
  IF blocked_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot block yourself';
  END IF;
  
  -- Remove existing friendship
  DELETE FROM friendships 
  WHERE (user_id = auth.uid() AND friend_id = blocked_user_id)
     OR (user_id = blocked_user_id AND friend_id = auth.uid());
  
  -- Remove pending friend requests in both directions
  DELETE FROM friend_requests
  WHERE (from_user_id = auth.uid() AND to_user_id = blocked_user_id)
     OR (from_user_id = blocked_user_id AND to_user_id = auth.uid());
  
  -- Add to blocked users
  INSERT INTO blocked_users (user_id, blocked_user_id, reason)
  VALUES (auth.uid(), blocked_user_id, block_reason)
  ON CONFLICT (user_id, blocked_user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unblock user function
CREATE OR REPLACE FUNCTION unblock_user(blocked_user_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM blocked_users 
  WHERE user_id = auth.uid() AND blocked_user_id = blocked_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is not blocked';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get friend status function
CREATE OR REPLACE FUNCTION get_friend_status(other_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  is_friend boolean;
  has_pending_request boolean;
  sent_request boolean;
  is_blocked boolean;
  is_blocking boolean;
BEGIN
  -- Check if blocked
  SELECT EXISTS(
    SELECT 1 FROM blocked_users 
    WHERE user_id = auth.uid() AND blocked_user_id = other_user_id
  ) INTO is_blocking;
  
  SELECT EXISTS(
    SELECT 1 FROM blocked_users 
    WHERE user_id = other_user_id AND blocked_user_id = auth.uid()
  ) INTO is_blocked;
  
  -- Check if friends
  SELECT EXISTS(
    SELECT 1 FROM friendships 
    WHERE user_id = auth.uid() AND friend_id = other_user_id
  ) INTO is_friend;
  
  -- Check pending requests
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
