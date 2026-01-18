/*
  # Voice Settings Synchronization

  1. New Tables
    - `voice_settings`
      - `user_id` (uuid, primary key, foreign key to auth.users)
      - `voice_enabled` (boolean, default true)
      - `voice_id` (text, default 'default')
      - `volume` (numeric, default 0.85)
      - `language` (text, default based on locale)
      - `recognition_mode` (text, default 'balanced')
      - `min_confidence` (numeric, default 0.6)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `voice_settings` table
    - Add policy for users to read their own voice settings
    - Add policy for users to insert their own voice settings
    - Add policy for users to update their own voice settings

  3. Notes
    - This table stores user voice preferences across all devices
    - Settings are synchronized automatically via Supabase
    - Each user can only have one voice settings record
*/

CREATE TABLE IF NOT EXISTS voice_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_enabled boolean DEFAULT true NOT NULL,
  voice_id text DEFAULT 'default' NOT NULL,
  volume numeric DEFAULT 0.85 NOT NULL,
  language text DEFAULT 'hu-HU' NOT NULL,
  recognition_mode text DEFAULT 'balanced' NOT NULL,
  min_confidence numeric DEFAULT 0.6 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voice_settings_user_id ON voice_settings(user_id);

ALTER TABLE voice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own voice settings"
  ON voice_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice settings"
  ON voice_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice settings"
  ON voice_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_voice_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voice_settings_updated_at
  BEFORE UPDATE ON voice_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_settings_updated_at();