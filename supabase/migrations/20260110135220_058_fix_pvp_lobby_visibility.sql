/*
  # Fix PVP Lobby Visibility
  
  1. Changes
    - Fix pvp_lobby SELECT policy to properly show waiting lobbies to all users
    - Previously the policy was too restrictive and only checked if user is authenticated
    - Now properly checks for status = 'waiting' OR user's own lobby entries
  
  2. Security
    - Users can view all lobby entries with status = 'waiting'
    - Users can also view their own lobby entries regardless of status
    - Maintains security by restricting write operations to own entries only
*/

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Users can view active lobby entries" ON pvp_lobby;

-- Recreate with proper visibility rules
CREATE POLICY "Users can view active lobby entries"
  ON pvp_lobby FOR SELECT
  TO authenticated
  USING (status = 'waiting' OR user_id = (SELECT auth.uid()));
