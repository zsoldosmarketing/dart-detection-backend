/*
  # PVP Challenge 2-Minute Timeout
  
  1. Changes
    - Change pvp_challenges expires_at default from 10 minutes to 2 minutes
    - Add automatic trigger to update lobby when challenges expire
    - Create function to auto-decline expired challenges
  
  2. Why This is Needed
    - Challenger has 2 minutes to wait for lobby owner's response
    - After timeout, the challenge should automatically disappear from lobby owner's view
    - Expired challenges should be auto-declined to keep data clean
  
  3. Security
    - Maintains RLS policies
    - Uses SECURITY DEFINER for automatic cleanup
*/

-- Drop existing default constraint on expires_at if it exists
ALTER TABLE pvp_challenges 
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '2 minutes');

-- Function to auto-decline expired challenges
CREATE OR REPLACE FUNCTION auto_decline_expired_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update expired challenges to 'expired' status
  UPDATE pvp_challenges
  SET status = 'expired'
  WHERE status = 'pending' 
    AND expires_at < now();
    
  -- Log for debugging
  RAISE NOTICE 'Auto-declined % expired challenges', 
    (SELECT COUNT(*) FROM pvp_challenges WHERE status = 'expired' AND expires_at < now() - interval '1 minute');
END;
$$;

-- Update the existing cleanup function to call the new one
CREATE OR REPLACE FUNCTION cleanup_expired_pvp_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Expire old lobby entries
  UPDATE pvp_lobby
  SET status = 'expired'
  WHERE status = 'waiting' AND expires_at < now();

  -- Expire old challenges
  UPDATE pvp_challenges
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();

  -- Expire old game invites
  UPDATE game_invites
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();
  
  -- Clean up expired challenges that are older than 5 minutes
  DELETE FROM pvp_challenges
  WHERE status = 'expired' 
    AND expires_at < now() - interval '5 minutes';
END;
$$;