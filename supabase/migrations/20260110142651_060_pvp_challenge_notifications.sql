/*
  # PVP Challenge Notification System

  1. New Function
    - `create_pvp_challenge_notification` - Creates a notification_receipt when a new PVP challenge is created

  2. New Trigger
    - `on_pvp_challenge_created` - Fires when a new row is inserted into pvp_challenges

  3. Changes
    - Automatically creates a notification for the lobby owner when someone challenges them
    - Notification includes challenger's display name and game details
    - Only creates notification for 'pending' status challenges

  4. Security
    - Function runs with SECURITY DEFINER to allow notification creation
    - Trigger executes automatically on INSERT
*/

-- Function to create notification when PVP challenge is created
CREATE OR REPLACE FUNCTION create_pvp_challenge_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_lobby_owner_id uuid;
  v_challenger_name text;
  v_game_details text;
BEGIN
  -- Only create notification for pending challenges
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Get the lobby owner's user_id
  SELECT user_id INTO v_lobby_owner_id
  FROM pvp_lobby
  WHERE id = NEW.lobby_id;

  -- Don't create notification if lobby owner not found
  IF v_lobby_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get challenger's display name
  SELECT COALESCE(display_name, username, 'Valaki')
  INTO v_challenger_name
  FROM user_profiles
  WHERE id = NEW.challenger_id;

  -- Get game details from lobby
  SELECT 
    starting_score || ' (' || 
    CASE 
      WHEN double_in AND double_out THEN 'Double In/Out'
      WHEN double_in THEN 'Double In'
      WHEN double_out THEN 'Double Out'
      ELSE 'Straight'
    END || ')'
  INTO v_game_details
  FROM pvp_lobby
  WHERE id = NEW.lobby_id;

  -- Create notification receipt
  INSERT INTO notification_receipts (
    user_id,
    category,
    title,
    body,
    action_url,
    is_read
  ) VALUES (
    v_lobby_owner_id,
    'game',
    'Új PVP Kihívás!',
    v_challenger_name || ' kihívott egy játékra: ' || COALESCE(v_game_details, 'X01'),
    '/arena?tab=waiting',
    false
  );

  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_pvp_challenge_created ON pvp_challenges;

-- Create trigger for PVP challenge creation
CREATE TRIGGER on_pvp_challenge_created
  AFTER INSERT ON pvp_challenges
  FOR EACH ROW
  EXECUTE FUNCTION create_pvp_challenge_notification();