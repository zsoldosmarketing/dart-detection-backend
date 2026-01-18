/*
  # Fix Preferred Doubles - User Profile Table

  1. Changes
    - Convert existing preferred_doubles from jsonb string array to integer array
    - Update user_profile table (not player_profiles which doesn't exist)
    - Migrate existing data: ["D20", "D16", "D8"] -> [20, 16, 8]
    
  2. Notes
    - Fixes "DD20" bug by using integer array instead of string array
    - This allows cleaner code and avoids double prefix issues
*/

DO $$
BEGIN
  -- If preferred_doubles is jsonb, convert it to integer array
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profile' 
    AND column_name = 'preferred_doubles'
    AND data_type = 'jsonb'
  ) THEN
    -- Add new integer array column
    ALTER TABLE user_profile ADD COLUMN preferred_doubles_temp integer[];
    
    -- Convert existing data from ["D20", "D16", "D8"] to [20, 16, 8]
    -- Extract numbers from strings like "D20" -> 20
    UPDATE user_profile
    SET preferred_doubles_temp = (
      SELECT ARRAY(
        SELECT substring(elem::text FROM '[0-9]+')::integer
        FROM jsonb_array_elements_text(preferred_doubles) AS elem
        WHERE elem::text ~ 'D[0-9]+'
      )
    )
    WHERE preferred_doubles IS NOT NULL;
    
    -- Set default for null or empty values
    UPDATE user_profile
    SET preferred_doubles_temp = ARRAY[20, 16, 8]
    WHERE preferred_doubles_temp IS NULL OR array_length(preferred_doubles_temp, 1) IS NULL;
    
    -- Drop old column and rename new one
    ALTER TABLE user_profile DROP COLUMN preferred_doubles;
    ALTER TABLE user_profile RENAME COLUMN preferred_doubles_temp TO preferred_doubles;
    
    -- Set default for new rows
    ALTER TABLE user_profile ALTER COLUMN preferred_doubles SET DEFAULT ARRAY[20, 16, 8];
  END IF;
  
  -- If column doesn't exist yet, create it as integer array
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profile' 
    AND column_name = 'preferred_doubles'
  ) THEN
    ALTER TABLE user_profile ADD COLUMN preferred_doubles integer[] DEFAULT ARRAY[20, 16, 8];
  END IF;
END $$;