-- Add password columns; default is bcrypt of "password" so existing students can log in.
ALTER TABLE public.aeirg_students
  ADD COLUMN IF NOT EXISTS password_hash text NOT NULL DEFAULT extensions.crypt('password', extensions.gen_salt('bf', 10)),
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;

-- Verify student credentials. Returns ok + name + must_change_password flag.
CREATE OR REPLACE FUNCTION public.aeirg_student_login(_matric text, _password text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM public.aeirg_students WHERE matric_number = _matric;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;
  IF s.password_hash IS NULL OR s.password_hash = '' THEN RETURN jsonb_build_object('ok', false); END IF;
  IF s.password_hash <> extensions.crypt(_password, s.password_hash) THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'matric_number', s.matric_number,
    'name', s.name,
    'must_change_password', s.must_change_password
  );
END;
$$;

-- First-time password set: only allowed while must_change_password is true.
CREATE OR REPLACE FUNCTION public.aeirg_student_force_set_password(_matric text, _new text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM public.aeirg_students WHERE matric_number = _matric;
  IF NOT FOUND OR NOT COALESCE(s.must_change_password, false) THEN RETURN false; END IF;
  IF length(_new) < 6 THEN RETURN false; END IF;
  UPDATE public.aeirg_students
     SET password_hash = extensions.crypt(_new, extensions.gen_salt('bf', 10)),
         must_change_password = false
   WHERE matric_number = _matric;
  RETURN true;
END;
$$;

-- Change password with current-password verification.
CREATE OR REPLACE FUNCTION public.aeirg_student_change_password(_matric text, _current text, _new text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM public.aeirg_students WHERE matric_number = _matric;
  IF NOT FOUND THEN RETURN false; END IF;
  IF s.password_hash <> extensions.crypt(_current, s.password_hash) THEN RETURN false; END IF;
  IF length(_new) < 6 THEN RETURN false; END IF;
  UPDATE public.aeirg_students
     SET password_hash = extensions.crypt(_new, extensions.gen_salt('bf', 10)),
         must_change_password = false
   WHERE matric_number = _matric;
  RETURN true;
END;
$$;