/*
  # Program Enrollments Table

  1. New Tables
    - `program_enrollments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `program_id` (uuid, references programs)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz, nullable)
      - `current_day` (int)
      - `progress_pct` (int)

  2. Security
    - Enable RLS on the table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS program_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_id uuid REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  current_day int NOT NULL DEFAULT 1,
  progress_pct int NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  UNIQUE(user_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_program_enrollments_user ON program_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_program ON program_enrollments(program_id);

ALTER TABLE program_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their enrollments"
  ON program_enrollments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can enroll in programs"
  ON program_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their enrollments"
  ON program_enrollments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
