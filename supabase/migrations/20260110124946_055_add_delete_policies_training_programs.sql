/*
  # Add DELETE policies for training sessions and program enrollments

  1. Changes
    - Add DELETE policy for training_sessions table
      - Users can delete their own training sessions
    - Add DELETE policy for program_enrollments table
      - Users can delete their own program enrollments

  2. Security
    - Both policies check that auth.uid() matches user_id
    - Users can only delete their own data
*/

-- Add DELETE policy for training_sessions
CREATE POLICY "Users can delete own training sessions"
  ON training_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add DELETE policy for program_enrollments
CREATE POLICY "Users can delete their enrollments"
  ON program_enrollments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
