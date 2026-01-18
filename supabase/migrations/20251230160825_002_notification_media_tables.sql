/*
  # Notification and Media Tables
  
  ## Tables Created
  - notifications - Admin notification campaigns
  - notification_targets - User targeting
  - notification_receipts - User inbox / delivery tracking
  - media_assets - Uploaded media with WEBP processing
  
  ## Security
  - RLS enabled on all tables
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text DEFAULT 'system' CHECK (category IN ('system', 'game', 'club', 'tournament', 'admin', 'nudge')),
  image_url text,
  action_url text,
  cta_buttons jsonb,
  target_segment jsonb,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  total_targeted integer DEFAULT 0,
  total_sent integer DEFAULT 0,
  total_delivered integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  total_failed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profile
      WHERE user_profile.id = auth.uid()
      AND user_profile.is_admin = true
    )
  );

CREATE TABLE IF NOT EXISTS notification_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'failed')),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notification_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification targets"
  ON notification_targets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification targets"
  ON notification_targets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS notification_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  category text DEFAULT 'system',
  image_url text,
  action_url text,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notification_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own receipts"
  ON notification_receipts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own receipts"
  ON notification_receipts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert receipts"
  ON notification_receipts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename text NOT NULL,
  storage_path text NOT NULL,
  webp_path text,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  width integer,
  height integer,
  uploaded_by uuid REFERENCES auth.users(id),
  purpose text DEFAULT 'notification',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view media"
  ON media_assets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert media"
  ON media_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profile
      WHERE user_profile.id = auth.uid()
      AND user_profile.is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_notification_receipts_user ON notification_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_receipts_unread ON notification_receipts(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notification_targets_notification ON notification_targets(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_targets_user ON notification_targets(user_id);