
-- 1) aeirg_admin_config: no public read; expose only it_period_end_date via SDF
DROP POLICY IF EXISTS aeirg_config_read ON public.aeirg_admin_config;
REVOKE SELECT ON public.aeirg_admin_config FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.aeirg_get_it_period_end()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT it_period_end_date FROM public.aeirg_admin_config WHERE id = 1 $$;
REVOKE ALL ON FUNCTION public.aeirg_get_it_period_end() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aeirg_get_it_period_end() TO anon, authenticated;

-- 2) aeirg_students: hide password_hash from anon/authenticated via column grants
DROP POLICY IF EXISTS aeirg_students_read ON public.aeirg_students;
REVOKE SELECT ON public.aeirg_students FROM anon, authenticated;
GRANT SELECT (id, name, matric_number, added_at, must_change_password)
  ON public.aeirg_students TO anon, authenticated;
CREATE POLICY aeirg_students_read ON public.aeirg_students
  FOR SELECT TO anon, authenticated USING (true);

-- 3) aeirg_raw_packets: no public read
DROP POLICY IF EXISTS aeirg_packets_read ON public.aeirg_raw_packets;
REVOKE SELECT ON public.aeirg_raw_packets FROM anon, authenticated;

-- 4) aeirg_attendance: no direct table read; expose via SDF returning safe cols
DROP POLICY IF EXISTS aeirg_attendance_read ON public.aeirg_attendance;
REVOKE SELECT ON public.aeirg_attendance FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.aeirg_public_attendance()
RETURNS TABLE (
  id uuid,
  matric_number text,
  attendance_date date,
  manually_added boolean,
  source_packet_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, matric_number, attendance_date, manually_added, source_packet_id
  FROM public.aeirg_attendance
$$;
REVOKE ALL ON FUNCTION public.aeirg_public_attendance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aeirg_public_attendance() TO anon, authenticated;

-- 5) checkin_flags: no public read (admin uses service_role via server fn)
DROP POLICY IF EXISTS checkin_flags_read ON public.checkin_flags;
REVOKE SELECT ON public.checkin_flags FROM anon, authenticated;

-- 6) Tighten SDFs: revoke where clients don't need them
REVOKE EXECUTE ON FUNCTION public.aeirg_update_password(text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon, authenticated, PUBLIC;
