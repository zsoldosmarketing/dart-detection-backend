/*
  # Auto-cleanup Expired Challenge Notifications
  
  1. New Function
    - `cleanup_expired_challenge_notifications` - Deletes notifications related to expired/declined challenges
  
  2. Changes
    - When challenges expire or are declined, their notifications are deleted
    - Clean notifications for challenges that are no longer pending
  
  3. Why This is Needed
    - Keeps the notification inbox clean
    - Removes outdated challenge invitations
    - Improves user experience by not showing irrelevant notifications
  
  4. Security
    - Uses SECURITY DEFINER for automatic cleanup
*/

-- Function to cleanup expired challenge notifications
CREATE OR REPLACE FUNCTION cleanup_expired_challenge_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete notifications for challenges that are no longer pending (expired, declined, accepted)
  DELETE FROM notification_receipts
  WHERE category = 'game'
    AND body LIKE '%kihívott%'
    AND created_at < now() - interval '2 minutes'
    AND EXISTS (
      SELECT 1 FROM pvp_challenges
      WHERE pvp_challenges.created_at::date = notification_receipts.created_at::date
        AND pvp_challenges.status != 'pending'
    );
    
  -- Also delete old challenge notifications that are more than 1 hour old
  DELETE FROM notification_receipts
  WHERE category = 'game'
    AND body LIKE '%kihívott%'
    AND created_at < now() - interval '1 hour';
END;
$$;

-- Update the existing cleanup function to include notification cleanup
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
    
  -- Clean up challenge notifications
  PERFORM cleanup_expired_challenge_notifications();
END;
$$;