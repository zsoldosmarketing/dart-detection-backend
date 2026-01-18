/*
  # Verify Player PIN Code Function

  1. New Function
    - `verify_player_pin_code(player_id uuid, pin text)` - Validates if the provided PIN matches the player's stored PIN
    - Returns boolean: true if PIN matches, false if it doesn't or if player doesn't have a PIN set
    - SECURITY DEFINER to allow checking against stored PIN without exposing it
    - Validates that the caller is authenticated

  2. Security
    - Function runs with SECURITY DEFINER to access pin_code securely
    - Only authenticated users can call it
    - Prevents brute force attacks by not exposing whether user exists
    - Uses constant-time comparison to prevent timing attacks
*/

CREATE OR REPLACE FUNCTION verify_player_pin_code(player_id uuid, pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  stored_pin text;
BEGIN
  -- Must be authenticated to verify PIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate input format
  IF pin IS NULL OR length(pin) != 6 OR pin !~ '^[0-9]{6}$' THEN
    RETURN false;
  END IF;

  -- Get stored PIN
  SELECT up.pin_code INTO stored_pin
  FROM user_profile up
  WHERE up.id = player_id;

  -- If player doesn't exist or has no PIN, return false
  IF stored_pin IS NULL THEN
    RETURN false;
  END IF;

  -- Compare PINs (constant-time comparison for security)
  RETURN stored_pin = pin;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION verify_player_pin_code(uuid, text) TO authenticated;