
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.aeirg_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  matric_number text NOT NULL UNIQUE,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.aeirg_raw_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  assigned_date date NOT NULL,
  matric_numbers_json jsonb NOT NULL,
  packet_source text DEFAULT 'hardware-sync'
);

CREATE TABLE public.aeirg_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matric_number text NOT NULL REFERENCES public.aeirg_students(matric_number) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  source_packet_id uuid REFERENCES public.aeirg_raw_packets(id) ON DELETE SET NULL,
  manually_added boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(matric_number, attendance_date)
);

CREATE TABLE public.aeirg_cancelled_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cancelled_date date NOT NULL UNIQUE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.aeirg_admin_config (
  id integer PRIMARY KEY DEFAULT 1,
  password_hash text NOT NULL,
  it_period_end_date date,
  CONSTRAINT aeirg_admin_config_singleton CHECK (id = 1)
);

INSERT INTO public.aeirg_admin_config (id, password_hash)
VALUES (1, extensions.crypt('Abolarinwa', extensions.gen_salt('bf', 10)));

ALTER TABLE public.aeirg_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aeirg_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aeirg_cancelled_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aeirg_raw_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aeirg_admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY aeirg_students_read ON public.aeirg_students FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY aeirg_attendance_read ON public.aeirg_attendance FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY aeirg_cancelled_read ON public.aeirg_cancelled_days FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY aeirg_packets_read ON public.aeirg_raw_packets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY aeirg_config_read ON public.aeirg_admin_config FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.aeirg_verify_password(_password text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.aeirg_admin_config
    WHERE id = 1 AND password_hash = extensions.crypt(_password, password_hash)
  );
$$;

CREATE OR REPLACE FUNCTION public.aeirg_update_password(_current text, _new text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.aeirg_verify_password(_current) THEN
    RETURN false;
  END IF;
  UPDATE public.aeirg_admin_config
    SET password_hash = extensions.crypt(_new, extensions.gen_salt('bf', 10))
    WHERE id = 1;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aeirg_verify_password(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aeirg_update_password(text, text) TO anon, authenticated;
