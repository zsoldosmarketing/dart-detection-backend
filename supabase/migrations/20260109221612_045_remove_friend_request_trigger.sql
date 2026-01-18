/*
  # Remove Friend Request Trigger

  1. Changes
    - Drop the notify_friend_request trigger as push notifications are now handled from frontend
    - Drop the notify_friend_request function

  2. Reason
    - Frontend has better access to environment variables
    - More reliable notification delivery
    - Better error handling
*/

DROP TRIGGER IF EXISTS notify_friend_request_trigger ON friend_requests;
DROP FUNCTION IF EXISTS notify_friend_request();
