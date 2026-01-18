/*
  # Sync PVP Challenge Status with Game Status

  1. New Function
    - `sync_pvp_challenge_status()` - Trigger function that automatically updates pvp_challenges status when game_rooms status changes

  2. New Trigger
    - `trigger_sync_pvp_challenge_status` - Fires after UPDATE on game_rooms to sync challenge status

  3. Changes
    - When game_rooms status changes to 'completed', 'abandoned', 'forfeited', the related pvp_challenges status is set to 'expired'
    - Ensures data consistency between game_rooms and pvp_challenges tables
    - Uses 'expired' status since 'completed' is not in the check constraint

  4. Data Fix
    - Updates existing abandoned challenges to expired status
*/

-- Function to sync pvp_challenges status with game_rooms status
CREATE OR REPLACE FUNCTION sync_pvp_challenge_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If game is completed, abandoned, or forfeited, update the challenge status to expired
  IF NEW.status IN ('completed', 'abandoned', 'forfeited') AND OLD.status != NEW.status THEN
    UPDATE pvp_challenges
    SET status = 'expired'
    WHERE room_id = NEW.id
      AND status IN ('pending', 'accepted');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on game_rooms
DROP TRIGGER IF EXISTS trigger_sync_pvp_challenge_status ON game_rooms;
CREATE TRIGGER trigger_sync_pvp_challenge_status
  AFTER UPDATE OF status ON game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION sync_pvp_challenge_status();

-- Fix existing abandoned challenges  
UPDATE pvp_challenges pc
SET status = 'expired'
FROM game_rooms gr
WHERE pc.room_id = gr.id
  AND pc.status IN ('pending', 'accepted')
  AND gr.status IN ('completed', 'abandoned', 'forfeited');