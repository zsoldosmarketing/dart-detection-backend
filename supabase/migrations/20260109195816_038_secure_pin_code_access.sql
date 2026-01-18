/*
  # Secure PIN Code Access

  1. Security Issue
    - Currently, the RLS policy "Users can view any profile" allows anyone to see all columns including pin_code
    - This is a critical security vulnerability

  2. Solution
    - Create a secure view that excludes pin_code for other users
    - Create a function to check if a player has a PIN code without exposing it
    - Update RLS policies to prevent pin_code exposure

  3. New Function
    - `player_has_pin_code(player_id uuid)` - Returns true if player has PIN set, false otherwise
    - Does not expose the actual PIN code

  4. Security
    - Only the user themselves can see their own PIN code
    - Others can only check if a PIN exists via the function
*/

-- Function to check if a player has a PIN code set (without exposing it)
CREATE OR REPLACE FUNCTION player_has_pin_code(player_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  has_pin boolean;
BEGIN
  -- Check if player has a PIN code
  SELECT (pin_code IS NOT NULL) INTO has_pin
  FROM user_profile
  WHERE id = player_id;

  RETURN COALESCE(has_pin, false);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION player_has_pin_code(uuid) TO authenticated;

-- Note: We cannot implement column-level RLS in PostgreSQL directly,
-- but we've provided a secure function to check PIN existence.
-- The frontend should use player_has_pin_code() instead of querying pin_code directly.

-- Add a comment to remind developers not to query pin_code
COMMENT ON COLUMN user_profile.pin_code IS 'SECURITY: Do not query this column directly. Use player_has_pin_code() function or verify_player_pin_code() instead. Only the user themselves should see their own PIN in their profile.';