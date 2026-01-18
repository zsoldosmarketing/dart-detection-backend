/*
  # Add RLS Policy for Password Reset Tokens
  
  1. Security
    - Add policy to allow users to view and manage their own password reset tokens
    - Tokens are sensitive and should only be accessible by the user who requested them
*/

-- Add policy for password_reset_tokens
CREATE POLICY "Users can view own tokens"
  ON password_reset_tokens FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own tokens"
  ON password_reset_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own tokens"
  ON password_reset_tokens FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
