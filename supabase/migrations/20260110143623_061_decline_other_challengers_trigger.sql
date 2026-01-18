/*
  # Decline Other Challengers When One is Accepted

  1. New Function
    - `decline_other_challengers` - When a challenge is accepted, declines all other pending challenges for the same lobby

  2. New Trigger
    - `on_pvp_challenge_accepted` - Fires when a pvp_challenge status changes to 'accepted'

  3. Changes
    - Automatically declines other pending challenges for the same lobby
    - Creates notifications for declined challengers
    - Only triggers when status changes to 'accepted'

  4. Security
    - Function runs with SECURITY DEFINER
    - Trigger executes on UPDATE
*/

-- Function to decline other challengers when one is accepted
CREATE OR REPLACE FUNCTION decline_other_challengers()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_other_challenge RECORD;
  v_lobby_owner_name text;
BEGIN
  -- Only process if status changed to 'accepted'
  IF NEW.status != 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  -- Get lobby owner's name for notifications
  SELECT COALESCE(up.display_name, up.username, 'Valaki')
  INTO v_lobby_owner_name
  FROM pvp_lobby pl
  JOIN user_profiles up ON up.id = pl.user_id
  WHERE pl.id = NEW.lobby_id;

  -- Decline all other pending challenges for this lobby
  FOR v_other_challenge IN
    SELECT id, challenger_id
    FROM pvp_challenges
    WHERE lobby_id = NEW.lobby_id
      AND id != NEW.id
      AND status = 'pending'
  LOOP
    -- Update challenge status to declined
    UPDATE pvp_challenges
    SET status = 'declined'
    WHERE id = v_other_challenge.id;

    -- Create notification for the declined challenger
    INSERT INTO notification_receipts (
      user_id,
      category,
      title,
      body,
      action_url,
      is_read
    ) VALUES (
      v_other_challenge.challenger_id,
      'game',
      'Kihívás elutasítva',
      v_lobby_owner_name || ' már elfogadott egy másik kihívást. Próbálj meg újra később!',
      '/arena?tab=browse',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_pvp_challenge_accepted ON pvp_challenges;

-- Create trigger for pvp challenge acceptance
CREATE TRIGGER on_pvp_challenge_accepted
  AFTER UPDATE OF status ON pvp_challenges
  FOR EACH ROW
  EXECUTE FUNCTION decline_other_challengers();