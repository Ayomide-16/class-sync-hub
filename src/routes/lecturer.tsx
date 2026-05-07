import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Radio, MapPin, Smartphone } from "lucide-react";
import { DAYS, formatLoggedAt } from "@/lib/time";
import { EspQrPanel } from "@/components/EspQrPanel";

export const Route = createFileRoute("/lecturer")({
  component: LecturerRoute,
});

function LecturerRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onDashboardRoot = pathname === "/lecturer" || pathname === "/lecturer/";

  return (
    <ProtectedRoute allowedRoles={["lecturer"]}>
      {onDashboardRoot ? (
        <DashboardLayout>
          <LecturerDashboard />
        </DashboardLayout>
      ) : (
        <Outlet />
      )}
    </ProtectedRoute>
  );
}

function LecturerDashboard() {
  const { user } = useAuth();

  // Active class via security-definer RPC.
  const active = useQuery({
    queryKey: ["active-schedule", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_schedule_for_lecturer", {
        _lecturer_id: user!.id,
      });
      if (error) throw error;
      return (data && data.length > 0) ? data[0] : null;
    },
  });

  // All courses for this lecturer.
  const courses = useQuery({
    queryKey: ["lecturer-courses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, course_code, course_name, schedules(id, day_of_week, start_time, end_time, venue, device_id)")
        .eq("lecturer_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeSchedId = active.data?.schedule_id;
  const activeCourseId = active.data?.course_id;

  // Live attendance for the active class (refreshes every 30s).
  const liveRoster = useQuery({
    queryKey: ["live-roster", activeSchedId],
    enabled: !!activeSchedId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("id, matric_number, student_name, method, logged_at, raw_time, time_synced")
        .eq("schedule_id", activeSchedId!)
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Past attendance for this lecturer's courses.
  const pastAttendance = useQuery({
    queryKey: ["lecturer-past-attendance", user?.id],
    enabled: !!user && (courses.data?.length ?? 0) > 0,
    queryFn: async () => {
      const courseIds = (courses.data ?? []).map((c: any) => c.id);
      if (courseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("id, matric_number, student_name, method, logged_at, raw_time, time_synced, course:courses(course_code), schedule_id")
        .in("course_id", courseIds)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lecturer Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome, {user?.full_name}</p>
      </div>

      <Card className={active.data ? "border-green-500/60 bg-green-50/50" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Radio className={`h-5 w-5 ${active.data ? "text-green-600 animate-pulse" : "text-muted-foreground"}`} />
              {active.data ? "Class in session" : "No class currently scheduled"}
            </CardTitle>
            {active.data && <Badge className="bg-green-600">LIVE</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {active.isLoading ? (
            <p className="text-sm text-muted-foreground">Checking schedule…</p>
          ) : active.data ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="font-semibold text-lg">{active.data.course_code}</span>{" "}
                  <span className="text-muted-foreground">{active.data.course_name}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {active.data.venue ?? "—"}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5" /> {active.data.device_id ?? "—"}
                </div>
                <div className="text-muted-foreground">
                  {DAYS[active.data.day_of_week]} ·{" "}
                  {String(active.data.start_time).slice(0, 5)}–{String(active.data.end_time).slice(0, 5)} WAT
                </div>
              </div>

              <div className="grid lg:grid-cols-[320px_1fr] gap-4">
                <EspQrPanel
                  scheduleId={active.data.schedule_id}
                  deviceId={active.data.device_id ?? "ESP32-LT101"}
                  courseCode={active.data.course_code}
                />
                <div>
                  <p className="text-sm font-medium mb-2">
                    Live attendance ({liveRoster.data?.length ?? 0})
                  </p>
                  {liveRoster.isLoading ? (
                    <p className="text-xs text-muted-foreground">Loading roster…</p>
                  ) : (liveRoster.data?.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Class is in session — no one has checked in yet.
                    </p>
                  ) : (
                    <RosterTable rows={liveRoster.data!} />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You have no class scheduled for the current time.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My courses & schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(courses.data ?? []).map((c: any) => (
            <div key={c.id} className="border rounded-md p-3">
              <div className="font-medium">
                {c.course_code} <span className="text-muted-foreground font-normal">— {c.course_name}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                {(c.schedules ?? []).length === 0 && <div>No schedules yet.</div>}
                {(c.schedules ?? []).map((s: any) => (
                  <div key={s.id}>
                    {DAYS[s.day_of_week]} {String(s.start_time).slice(0, 5)}–
                    {String(s.end_time).slice(0, 5)} · {s.venue ?? "—"} · {s.device_id ?? "—"}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {courses.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No courses assigned to you yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent attendance (all classes)</CardTitle>
        </CardHeader>
        <CardContent>
          {pastAttendance.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (pastAttendance.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance records yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Matric</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastAttendance.data!.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">
                      {formatLoggedAt(a.logged_at, a.raw_time)}
                    </TableCell>
                    <TableCell>{a.course?.course_code ?? "—"}</TableCell>
                    <TableCell>{a.student_name}</TableCell>
                    <TableCell className="font-mono text-xs">{a.matric_number}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{a.method}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RosterTable({ rows }: { rows: any[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Student</TableHead>
          <TableHead>Matric</TableHead>
          <TableHead>Method</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">{formatLoggedAt(r.logged_at, r.raw_time)}</TableCell>
            <TableCell>{r.student_name}</TableCell>
            <TableCell className="font-mono text-xs">{r.matric_number}</TableCell>
            <TableCell>
              <Badge variant={r.method === "2FA" ? "default" : "secondary"}>{r.method}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
