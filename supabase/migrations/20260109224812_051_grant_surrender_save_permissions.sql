/*
  # Grant Execute Permissions for Surrender and Save Functions

  1. Changes
    - Grant EXECUTE permission on surrender_game to authenticated users
    - Grant EXECUTE permission on save_and_pause_game to authenticated users

  2. Notes
    - These functions need explicit execute permissions to be callable via RPC
*/

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION surrender_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION save_and_pause_game(uuid, jsonb) TO authenticated;