
-- 1) checkin_flags table
CREATE TABLE public.checkin_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_at timestamptz NOT NULL DEFAULT now(),
  browser_token text NOT NULL,
  first_student_id text NOT NULL,
  attempted_student_id text NOT NULL,
  ble_device_name text,
  source text NOT NULL DEFAULT 'aeirg',
  flagged_date date,
  dismissed boolean NOT NULL DEFAULT false,
  dismissed_at timestamptz
);

ALTER TABLE public.checkin_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkin_flags_read"
ON public.checkin_flags
FOR SELECT
TO anon, authenticated
USING (true);

-- 2) AEIRG BLE student check-in RPC
CREATE OR REPLACE FUNCTION public.aeirg_record_ble_attendance(
  _matric text,
  _ble_device text DEFAULT NULL,
  _browser_token text DEFAULT NULL,
  _previous_student text DEFAULT NULL,
  _source text DEFAULT 'aeirg'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := ((now() AT TIME ZONE 'Africa/Lagos')::date);
  v_student record;
  v_existing record;
  v_packet_id uuid;
  v_already boolean := false;
  v_flag_id uuid;
BEGIN
  SELECT * INTO v_student FROM public.aeirg_students WHERE matric_number = _matric;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'student_not_found');
  END IF;

  SELECT * INTO v_existing FROM public.aeirg_attendance
    WHERE matric_number = _matric AND attendance_date = v_today;

  IF FOUND THEN
    v_already := true;
  ELSE
    INSERT INTO public.aeirg_raw_packets (matric_numbers_json, assigned_date, packet_source)
    VALUES (jsonb_build_array(_matric), v_today, 'ble_checkin')
    RETURNING id INTO v_packet_id;

    INSERT INTO public.aeirg_attendance (matric_number, attendance_date, source_packet_id, manually_added)
    VALUES (_matric, v_today, v_packet_id, false);
  END IF;

  -- Flag handling: only flag when previous student is provided AND differs.
  IF _browser_token IS NOT NULL
     AND _previous_student IS NOT NULL
     AND _previous_student <> _matric THEN
    INSERT INTO public.checkin_flags (
      browser_token, first_student_id, attempted_student_id,
      ble_device_name, source, flagged_date
    )
    VALUES (
      _browser_token, _previous_student, _matric,
      _ble_device, COALESCE(_source, 'aeirg'), v_today
    )
    RETURNING id INTO v_flag_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_recorded', v_already,
    'attendance_date', v_today,
    'student_name', v_student.name,
    'flag_id', v_flag_id
  );
END;
$$;

-- 3) Server-only flag insert RPC for the main app's QR scanner (no AEIRG attendance write)
CREATE OR REPLACE FUNCTION public.record_checkin_flag(
  _browser_token text,
  _first_student_id text,
  _attempted_student_id text,
  _ble_device text DEFAULT NULL,
  _source text DEFAULT 'main'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF _first_student_id = _attempted_student_id THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.checkin_flags (
    browser_token, first_student_id, attempted_student_id,
    ble_device_name, source, flagged_date
  )
  VALUES (
    _browser_token, _first_student_id, _attempted_student_id,
    _ble_device, COALESCE(_source, 'main'),
    ((now() AT TIME ZONE 'Africa/Lagos')::date)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
