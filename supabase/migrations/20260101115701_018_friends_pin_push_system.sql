/*
  # Friends, PIN Code, and Push Notification System

  1. Changes
    - Add `display_name` to user_profile if not exists
    - Add `pin_code` to user_profile for local multiplayer authentication
    - Add `bot_name` to game_players for customizable bot names
    - Create `friendships` table for friend connections
    - Create `friend_requests` table for pending friend invitations
    - Create `push_subscriptions` table for web push notifications
    - Create `push_notifications` table for notification history

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
    - Validate PIN code format and complexity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profile' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE user_profile ADD COLUMN display_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profile' AND column_name = 'pin_code'
  ) THEN
    ALTER TABLE user_profile ADD COLUMN pin_code text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_players' AND column_name = 'bot_name'
  ) THEN
    ALTER TABLE game_players ADD COLUMN bot_name text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(from_user_id, to_user_id),
  CHECK (from_user_id != to_user_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz DEFAULT now(),
  read_at timestamptz,
  type text NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'friend_request', 'game_invite', 'game_update', 'challenge', 'achievement')),
  related_id uuid
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships"
  ON friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can view relevant friend requests"
  ON friend_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create friend requests"
  ON friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update friend requests sent to them"
  ON friend_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);

CREATE POLICY "Users can delete own sent friend requests"
  ON friend_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = from_user_id);

CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own push subscriptions"
  ON push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions"
  ON push_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own push notifications"
  ON push_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own push notifications"
  ON push_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON friend_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_user_id ON push_notifications(user_id) WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION validate_pin_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pin_code IS NOT NULL THEN
    IF length(NEW.pin_code) != 6 THEN
      RAISE EXCEPTION 'PIN must be exactly 6 digits';
    END IF;

    IF NEW.pin_code !~ '^[0-9]{6}$' THEN
      RAISE EXCEPTION 'PIN must contain only digits';
    END IF;

    IF NEW.pin_code IN ('000000', '111111', '222222', '333333', '444444', '555555',
                         '666666', '777777', '888888', '999999', '123456', '654321',
                         '012345', '543210') THEN
      RAISE EXCEPTION 'PIN is too simple, please choose a more secure code';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_pin_code_trigger'
  ) THEN
    CREATE TRIGGER validate_pin_code_trigger
      BEFORE INSERT OR UPDATE OF pin_code ON user_profile
      FOR EACH ROW
      EXECUTE FUNCTION validate_pin_code();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION accept_friend_request(request_id uuid)
RETURNS void AS $$
DECLARE
  req friend_requests;
BEGIN
  SELECT * INTO req FROM friend_requests WHERE id = request_id AND to_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  IF req.status != 'pending' THEN
    RAISE EXCEPTION 'Friend request already processed';
  END IF;

  UPDATE friend_requests SET status = 'accepted', updated_at = now() WHERE id = request_id;

  INSERT INTO friendships (user_id, friend_id)
  VALUES (req.from_user_id, req.to_user_id);

  INSERT INTO friendships (user_id, friend_id)
  VALUES (req.to_user_id, req.from_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;