/*
  # Friend Request Push Notifications

  1. Changes
    - Create function to send push notification when friend request is created
    - Create trigger on friend_requests table to automatically notify users
    - Trigger calls the send-push edge function via http request

  2. Security
    - Function runs with SECURITY DEFINER to access service role
    - Only triggers on INSERT of new friend requests
    - Validates that the request is pending before sending notification
*/

CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS TRIGGER AS $$
DECLARE
  sender_name text;
  supabase_url text;
  service_role_key text;
BEGIN
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO sender_name
  FROM user_profile
  WHERE id = NEW.from_user_id;

  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'user_id', NEW.to_user_id::text,
        'title', 'Új barát kérés',
        'body', COALESCE(sender_name, 'Valaki') || ' barátnak jelölt téged!',
        'type', 'friend_request',
        'data', jsonb_build_object(
          'friend_request_id', NEW.id::text,
          'from_user_id', NEW.from_user_id::text
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'notify_friend_request_trigger'
  ) THEN
    CREATE TRIGGER notify_friend_request_trigger
      AFTER INSERT ON friend_requests
      FOR EACH ROW
      EXECUTE FUNCTION notify_friend_request();
  END IF;
END $$;
