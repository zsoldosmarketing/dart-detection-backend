/*
  # Fix validate_pin_code Function Security

  ## Security Improvements
  
  Set secure search_path for the validate_pin_code trigger function to prevent
  malicious search_path manipulation.
*/

CREATE OR REPLACE FUNCTION validate_pin_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;
