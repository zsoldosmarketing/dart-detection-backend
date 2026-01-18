/*
  # Club System Tables
  
  ## Tables Created
  - clubs - Club/clan definitions
  - club_members - Club membership
  - club_invites - Club invitations
  - club_feed_posts - Club activity feed
  - club_stats_daily - Aggregated club statistics
  
  ## Security
  - RLS enabled on all tables
*/

CREATE TABLE IF NOT EXISTS clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  avatar_url text,
  banner_url text,
  join_policy text DEFAULT 'request' CHECK (join_policy IN ('open', 'request', 'invite')),
  min_skill_rating numeric,
  max_members integer DEFAULT 100,
  is_active boolean DEFAULT true,
  total_members integer DEFAULT 0,
  total_games integer DEFAULT 0,
  total_wins integer DEFAULT 0,
  average_skill numeric DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active clubs"
  ON clubs FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Owner can update club"
  ON clubs FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated users can create clubs"
  ON clubs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'officer', 'member')),
  status text DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
  games_played integer DEFAULT 0,
  games_won integer DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(club_id, user_id)
);

ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club members"
  ON club_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join clubs"
  ON club_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Officers can update members"
  ON club_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = club_members.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'officer')
    ) OR user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = club_members.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'officer')
    ) OR user_id = auth.uid()
  );

CREATE POLICY "Users can leave clubs"
  ON club_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS club_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their club invites"
  ON club_invites FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

CREATE POLICY "Members can create invites"
  ON club_invites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Invitees can update invites"
  ON club_invites FOR UPDATE
  TO authenticated
  USING (auth.uid() = invitee_id)
  WITH CHECK (auth.uid() = invitee_id);

CREATE TABLE IF NOT EXISTS club_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_type text DEFAULT 'text' CHECK (post_type IN ('text', 'achievement', 'game_result', 'system')),
  content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE club_feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view feed"
  ON club_feed_posts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_feed_posts.club_id
      AND club_members.user_id = auth.uid()
      AND club_members.status = 'active'
    )
  );

CREATE POLICY "Members can post"
  ON club_feed_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = club_feed_posts.club_id
      AND club_members.user_id = auth.uid()
      AND club_members.status = 'active'
    )
  );

CREATE TABLE IF NOT EXISTS club_stats_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  active_members integer DEFAULT 0,
  games_played integer DEFAULT 0,
  games_won integer DEFAULT 0,
  total_score integer DEFAULT 0,
  checkouts integer DEFAULT 0,
  highest_checkout integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(club_id, date)
);

ALTER TABLE club_stats_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club stats"
  ON club_stats_daily FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_clubs_name ON clubs(name);
CREATE INDEX IF NOT EXISTS idx_club_members_club ON club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_feed_club ON club_feed_posts(club_id);