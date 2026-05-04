
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('student', 'lecturer', 'course_rep');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  matric_number TEXT UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  rfid_card_id TEXT,
  fingerprint_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles (separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- has_role security-definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Auto-create profile on signup; uses raw_user_meta_data for full_name, matric_number, role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role app_role;
BEGIN
  INSERT INTO public.profiles (id, matric_number, full_name)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data ->> 'matric_number', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  v_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'student');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Courses
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code TEXT NOT NULL UNIQUE,
  course_name TEXT NOT NULL,
  lecturer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  course_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Schedules: day_of_week 0=Sunday .. 6=Saturday, times stored as TIME (interpreted as WAT)
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedules_course ON public.schedules(course_id);
CREATE INDEX idx_schedules_dow ON public.schedules(day_of_week);

-- Enrollments
CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);
CREATE INDEX idx_enroll_student ON public.course_enrollments(student_id);

-- Attendance logs (from ESP sync)
CREATE TABLE public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  matric_number TEXT NOT NULL,
  student_name TEXT NOT NULL,
  method TEXT NOT NULL,
  logged_at TIMESTAMPTZ,
  raw_time TEXT,
  time_synced BOOLEAN NOT NULL DEFAULT TRUE,
  unmatched BOOLEAN NOT NULL DEFAULT FALSE,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attendance_student ON public.attendance_logs(student_id);
CREATE INDEX idx_attendance_schedule ON public.attendance_logs(schedule_id);
CREATE INDEX idx_attendance_logged_at ON public.attendance_logs(logged_at);
CREATE INDEX idx_attendance_matric ON public.attendance_logs(matric_number);

-- Enrollment records (hardware uploads)
CREATE TABLE public.enrollment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matric_number TEXT NOT NULL,
  student_name TEXT NOT NULL,
  rfid_card_id TEXT,
  fingerprint_id INTEGER,
  enrolled_at TIMESTAMPTZ,
  raw_time TEXT,
  time_synced BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_enrollment_matric ON public.enrollment_records(matric_number);

-- Active schedule helper: finds matching schedule for a lecturer at NOW (WAT = UTC+1)
CREATE OR REPLACE FUNCTION public.get_active_schedule_for_lecturer(_lecturer_id UUID)
RETURNS TABLE (
  schedule_id UUID,
  course_id UUID,
  course_code TEXT,
  course_name TEXT,
  day_of_week SMALLINT,
  start_time TIME,
  end_time TIME,
  venue TEXT,
  device_id TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH wat AS (
    SELECT (now() AT TIME ZONE 'Africa/Lagos') AS now_wat
  )
  SELECT s.id, c.id, c.course_code, c.course_name, s.day_of_week, s.start_time, s.end_time, s.venue, s.device_id
  FROM public.schedules s
  JOIN public.courses c ON c.id = s.course_id
  CROSS JOIN wat
  WHERE c.lecturer_id = _lecturer_id
    AND s.day_of_week = EXTRACT(DOW FROM wat.now_wat)::SMALLINT
    AND (wat.now_wat)::TIME >= s.start_time
    AND (wat.now_wat)::TIME <= s.end_time
  ORDER BY s.start_time
  LIMIT 1;
$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_records ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone authenticated can read; users can update own
CREATE POLICY "profiles_read_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles: read own; course reps read all
CREATE POLICY "roles_read_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "roles_read_rep" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'course_rep'));

-- Courses: all authenticated read; only course reps modify
CREATE POLICY "courses_read" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses_insert_rep" ON public.courses FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'course_rep'));
CREATE POLICY "courses_update_rep" ON public.courses FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'course_rep'));
CREATE POLICY "courses_delete_rep" ON public.courses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'course_rep'));

-- Schedules: same
CREATE POLICY "schedules_read" ON public.schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "schedules_insert_rep" ON public.schedules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'course_rep'));
CREATE POLICY "schedules_update_rep" ON public.schedules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'course_rep'));
CREATE POLICY "schedules_delete_rep" ON public.schedules FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'course_rep'));

-- Enrollments
CREATE POLICY "enroll_read" ON public.course_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "enroll_insert_rep" ON public.course_enrollments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'course_rep'));
CREATE POLICY "enroll_delete_rep" ON public.course_enrollments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'course_rep'));

-- Attendance logs
-- Students: read own
CREATE POLICY "att_read_own" ON public.attendance_logs FOR SELECT TO authenticated USING (auth.uid() = student_id);
-- Lecturers: read attendance for their courses
CREATE POLICY "att_read_lecturer" ON public.attendance_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = attendance_logs.course_id AND c.lecturer_id = auth.uid()));
-- Course reps: read all
CREATE POLICY "att_read_rep" ON public.attendance_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'course_rep'));

-- Enrollment records: course reps read
CREATE POLICY "enr_records_read_rep" ON public.enrollment_records FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'course_rep'));
