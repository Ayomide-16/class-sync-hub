// Student web check-in: receives a scanned ESP QR payload, validates the
// active schedule, and writes an attendance_logs row as the signed-in student.
// Payload format from ESP / lecturer display:
//   ATTENDESP|<device_id>|<course_code>|<schedule_id>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "missing_authorization" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // User-scoped client to identify caller.
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes.user) return json({ error: "unauthorized" }, 401);
  const userId = userRes.user.id;

  let payload: string | null = null;
  try {
    const body = await req.json();
    payload = (body?.payload ?? "").toString().trim();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  if (!payload) return json({ error: "missing_payload" }, 400);

  const parts = payload.split("|");
  if (parts.length < 4 || parts[0] !== "ATTENDESP") {
    return json({ error: "invalid_qr", detail: "Not an AttendESP QR code." }, 400);
  }
  const [, deviceId, courseCode, scheduleId] = parts;

  // Service-role client for trusted reads/writes.
  const admin = createClient(url, service);

  // Load profile (need matric/full_name) and schedule.
  const [{ data: profile }, { data: schedule }] = await Promise.all([
    admin
      .from("profiles")
      .select("matric_number, full_name")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("schedules")
      .select("id, course_id, day_of_week, start_time, end_time, device_id, course:courses(course_code)")
      .eq("id", scheduleId)
      .maybeSingle(),
  ]);

  if (!profile?.matric_number) {
    return json({ error: "no_profile", detail: "Student profile not found." }, 400);
  }
  if (!schedule) {
    return json({ error: "schedule_not_found" }, 404);
  }
  // Light sanity check vs scanned values.
  if (schedule.course?.course_code && courseCode && schedule.course.course_code !== courseCode) {
    return json({ error: "qr_course_mismatch" }, 400);
  }

  // Verify schedule is active right now in WAT.
  const watNow = new Date(Date.now() + 60 * 60 * 1000);
  const dow = watNow.getUTCDay();
  const hhmmss = watNow.toISOString().slice(11, 19);
  if (schedule.day_of_week !== dow) {
    return json({ error: "not_active", detail: "Class is not scheduled today." }, 400);
  }
  if (hhmmss < String(schedule.start_time) || hhmmss > String(schedule.end_time)) {
    return json({ error: "not_active", detail: "Class is not in session right now." }, 400);
  }

  // Avoid duplicate check-ins for this student in this schedule today.
  const startOfDayUtc = new Date(Date.UTC(
    watNow.getUTCFullYear(), watNow.getUTCMonth(), watNow.getUTCDate(),
  ) - 60 * 60 * 1000).toISOString();

  const { data: existing } = await admin
    .from("attendance_logs")
    .select("id")
    .eq("student_id", userId)
    .eq("schedule_id", schedule.id)
    .gte("created_at", startOfDayUtc)
    .limit(1);
  if (existing && existing.length > 0) {
    return json({ ok: true, duplicate: true, message: "You have already checked in for this class." });
  }

  const nowIso = new Date().toISOString();
  const { error: insErr } = await admin.from("attendance_logs").insert({
    student_id: userId,
    schedule_id: schedule.id,
    course_id: schedule.course_id,
    matric_number: profile.matric_number,
    student_name: profile.full_name,
    method: "QR+WEB",
    logged_at: nowIso,
    raw_time: nowIso,
    time_synced: true,
    unmatched: false,
    device_id: deviceId,
  });
  if (insErr) {
    console.error("checkin insert failed", insErr);
    return json({ error: "db_insert_failed", detail: insErr.message }, 500);
  }

  return json({
    ok: true,
    course_code: schedule.course?.course_code ?? courseCode,
    device_id: deviceId,
    message: "Attendance recorded.",
  });
});
