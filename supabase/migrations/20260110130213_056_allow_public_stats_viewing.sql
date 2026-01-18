/*
  # Allow viewing other players' statistics

  1. Changes
    - Drop the restrictive "Users can view own stats summary" policy
    - Create a new policy that allows all authenticated users to view any player's statistics
    - This is needed for:
      - PVP matchmaking (seeing opponent stats)
      - Leaderboards
      - Player profiles
      - Tournament brackets
      
  2. Security
    - Statistics are read-only for other users
    - Users can still only update their own statistics
    - Users can still only insert their own statistics
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own stats summary" ON player_statistics_summary;

-- Create new policy that allows viewing all player statistics
CREATE POLICY "Anyone can view all player statistics"
  ON player_statistics_summary FOR SELECT
  TO authenticated
  USING (true);
