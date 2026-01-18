/*
  # Auto-create user profile on signup

  1. Purpose
    - Automatically creates a user_profile when a new user signs up
    - Prevents race conditions and duplicate username issues during registration
    - Ensures data consistency between auth.users and user_profile tables

  2. Changes
    - Creates a trigger function that runs after INSERT on auth.users
    - Generates a unique username if not provided in raw_user_meta_data
    - Sets sensible defaults for new profiles (theme: dark, locale: hu)

  3. Benefits
    - Eliminates the need for manual profile creation in the application code
    - Guarantees that every auth user has a corresponding profile
    - Prevents registration failures due to profile creation errors

  4. Important Notes
    - Username is taken from raw_user_meta_data['username'] if available
    - If username is not provided or conflicts, generates one from email
    - Uses unique constraint to prevent duplicate usernames
    - If username generation fails, uses user ID as fallback
*/

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_username text;
  v_display_name text;
  v_email_prefix text;
  v_counter int := 0;
BEGIN
  -- Extract username from metadata if available
  v_username := NEW.raw_user_meta_data->>'username';

  -- If no username provided, generate from email
  IF v_username IS NULL OR v_username = '' THEN
    -- Get email prefix (before @)
    v_email_prefix := split_part(NEW.email, '@', 1);

    -- Remove special characters and make lowercase
    v_email_prefix := lower(regexp_replace(v_email_prefix, '[^a-zA-Z0-9]', '', 'g'));

    -- Try to use email prefix as username
    v_username := v_email_prefix;

    -- If username already exists, add numbers until we find a unique one
    WHILE EXISTS (SELECT 1 FROM public.user_profile WHERE username = v_username) LOOP
      v_counter := v_counter + 1;
      v_username := v_email_prefix || v_counter;

      -- Safety limit to prevent infinite loop
      IF v_counter > 9999 THEN
        v_username := 'user_' || substring(NEW.id::text from 1 for 8);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Use username as display_name if not provided
  v_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', v_username);

  -- Insert user profile
  INSERT INTO public.user_profile (
    id,
    username,
    display_name,
    email,
    theme,
    locale,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_username,
    v_display_name,
    NEW.email,
    'dark',
    'hu',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- If username is still taken (race condition), use user ID
    INSERT INTO public.user_profile (
      id,
      username,
      display_name,
      email,
      theme,
      locale,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      'user_' || substring(NEW.id::text from 1 for 8),
      v_display_name,
      NEW.email,
      'dark',
      'hu',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Error creating user profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.handle_new_user() TO postgres, service_role;

-- Add helpful comment
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a user_profile when a new user signs up through Supabase Auth';
