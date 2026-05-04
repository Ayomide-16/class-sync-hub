// AttendClass ESP32 hardware sync endpoint.
// Accepts two raw-CSV POSTs (attendance / enrollment) keyed by x-sync-file-type header.
// Verifies x-device-key. Tolerates TIME_NOT_SYNCED. Matches schedules by current WAT day/time.
// CORS open: ESP devices and admin tooling both call this.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const DEVICE_KEY = "attendesp_device_key_2026";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-key, x-sync-file-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Parse CSV text (no quoting in ESP output) → array of arrays.
function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.split(",").map((c) => c.trim()));
}

// Convert "YYYY-MM-DD HH:mm:ss" interpreted as WAT (UTC+1) to a real ISO timestamp.
function watStringToIso(raw: string): string | null {
  if (!raw || raw === "TIME_NOT_SYNCED") return null;
  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!m) return null;
  const [_, Y, Mo, D, H, Mi, S] = m;
  // Treat raw as WAT (UTC+1). Convert to UTC by subtracting 1 hour.
  // Build the WAT moment as UTC then offset.
  const utcMs = Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +S) - 60 * 60 * 1000;
  if (Number.isNaN(utcMs)) return null;
  // Drop epoch-zero garbage (1970-01-01 ...).
  if (utcMs < Date.UTC(2024, 0, 1)) return null;
  return new Date(utcMs).toISOString();
}

// Given a UTC ISO timestamp, return its WAT day-of-week (0=Sun..6=Sat) and TIME string "HH:MM:SS".
function watParts(iso: string): { dow: number; time: string } {
  const t = new Date(iso).getTime() + 60 * 60 * 1000; // UTC -> WAT
  const d = new Date(t);
  return {
    dow: d.getUTCDay(),
    time: d.toISOString().slice(11, 19),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const deviceKey = req.headers.get("x-device-key");
  if (deviceKey !== DEVICE_KEY) return json({ error: "unauthorized" }, 401);

  const fileType = req.headers.get("x-sync-file-type");
  if (fileType !== "attendance" && fileType !== "enrollment") {
    return json({ error: "missing_or_invalid_x-sync-file-type" }, 400);
  }

  const body = await req.text();
  const rows = parseCsv(body);
  if (rows.length === 0) return json({ ok: true, processed: 0 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const dataRows = rows.slice(1); // drop header

  if (fileType === "attendance") {
    // Pre-fetch lookup tables.
    const matrics = Array.from(new Set(dataRows.map((r) => r[2]).filter(Boolean)));
    const { data: students } = await supabase
      .from("profiles")
      .select("id, matric_number")
      .in("matric_number", matrics.length ? matrics : ["__none__"]);
    const studentByMatric = new Map((students ?? []).map((s) => [s.matric_number, s.id]));

    const { data: schedules } = await supabase
      .from("schedules")
      .select("id, course_id, day_of_week, start_time, end_time");
    const allSchedules = schedules ?? [];

    const inserts: any[] = [];
    let unmatchedCount = 0;

    for (const r of dataRows) {
      const [rawTime, name, matric, method] = r;
      const iso = watStringToIso(rawTime);
      const timeSynced = iso !== null;
      let scheduleId: string | null = null;
      let courseId: string | null = null;
      if (iso) {
        const { dow, time } = watParts(iso);
        const match = allSchedules.find(
          (s: any) =>
            s.day_of_week === dow &&
            time >= s.start_time &&
            time <= s.end_time,
        );
        if (match) {
          scheduleId = match.id;
          courseId = match.course_id;
        }
      }
      const unmatched = !scheduleId;
      if (unmatched) unmatchedCount++;
      inserts.push({
        student_id: studentByMatric.get(matric) ?? null,
        schedule_id: scheduleId,
        course_id: courseId,
        matric_number: matric ?? "",
        student_name: name ?? "",
        method: method ?? "",
        logged_at: iso,
        raw_time: rawTime,
        time_synced: timeSynced,
        unmatched,
      });
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("attendance_logs").insert(inserts);
      if (error) {
        console.error("attendance insert failed", error);
        return json({ error: "db_insert_failed", detail: error.message }, 500);
      }
    }
    return json({
      ok: true,
      type: "attendance",
      processed: inserts.length,
      unmatched: unmatchedCount,
    });
  }

  // ----- enrollment -----
  const enrollments: any[] = [];
  for (const r of dataRows) {
    const [rawTime, name, matric, rfid, fp] = r;
    const iso = watStringToIso(rawTime);
    enrollments.push({
      matric_number: matric ?? "",
      student_name: name ?? "",
      rfid_card_id: rfid || null,
      fingerprint_id: fp ? Number(fp) : null,
      enrolled_at: iso,
      raw_time: rawTime,
      time_synced: iso !== null,
    });
  }

  if (enrollments.length > 0) {
    const { error } = await supabase.from("enrollment_records").insert(enrollments);
    if (error) {
      console.error("enrollment insert failed", error);
      return json({ error: "db_insert_failed", detail: error.message }, 500);
    }

    // Update profiles for matching matrics with the latest rfid/fingerprint.
    for (const e of enrollments) {
      if (!e.matric_number) continue;
      await supabase
        .from("profiles")
        .update({
          rfid_card_id: e.rfid_card_id,
          fingerprint_id: e.fingerprint_id,
          updated_at: new Date().toISOString(),
        })
        .eq("matric_number", e.matric_number);
    }
  }
  return json({ ok: true, type: "enrollment", processed: enrollments.length });
});
