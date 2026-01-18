/*
  # Fix user_profiles to user_profile table references
  
  1. Changes
    - Fix create_pvp_challenge_notification() function to use user_profile instead of user_profiles
    - Fix decline_other_challengers() function to use user_profile instead of user_profiles
    - Fix get_paused_games() function to use user_profile instead of user_profiles
  
  2. Security
    - Functions maintain SECURITY DEFINER for proper RLS handling
    - No changes to security model
*/

-- Fix create_pvp_challenge_notification function
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

  -- Get challenger's display name (FIXED: user_profile not user_profiles)
  SELECT COALESCE(display_name, username, 'Valaki')
  INTO v_challenger_name
  FROM user_profile
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

-- Fix decline_other_challengers function
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

  -- Get lobby owner's name for notifications (FIXED: user_profile not user_profiles)
  SELECT COALESCE(up.display_name, up.username, 'Valaki')
  INTO v_lobby_owner_name
  FROM pvp_lobby pl
  JOIN user_profile up ON up.id = pl.user_id
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

-- Drop and recreate get_paused_games function
DROP FUNCTION IF EXISTS get_paused_games(uuid);

CREATE FUNCTION get_paused_games(p_user_id uuid)
RETURNS TABLE (
  game_id uuid,
  game_mode text,
  paused_at timestamptz,
  opponent_id uuid,
  opponent_name text,
  opponent_avatar text,
  user_game_state jsonb,
  opponent_game_state jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id AS game_id,
    g.game_mode,
    g.paused_at,
    gp_opponent.user_id AS opponent_id,
    COALESCE(up_opponent.display_name, up_opponent.username, 'Unknown') AS opponent_name,
    up_opponent.avatar_url AS opponent_avatar,
    gp_user.game_state AS user_game_state,
    gp_opponent.game_state AS opponent_game_state
  FROM online_games g
  INNER JOIN game_players gp_user ON g.id = gp_user.game_id AND gp_user.user_id = p_user_id
  INNER JOIN game_players gp_opponent ON g.id = gp_opponent.game_id AND gp_opponent.user_id != p_user_id
  INNER JOIN user_profile up_opponent ON gp_opponent.user_id = up_opponent.id
  WHERE g.status = 'paused'
  ORDER BY g.paused_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_paused_games(uuid) TO authenticated;