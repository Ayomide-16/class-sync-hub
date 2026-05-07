import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Clock, BookOpen } from "lucide-react";
import { formatLoggedAt } from "@/lib/time";
import { StudentQrScanner } from "@/components/StudentQrScanner";

export const Route = createFileRoute("/student")({
  component: StudentRoute,
});

function StudentRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onDashboardRoot = pathname === "/student" || pathname === "/student/";

  return (
    <ProtectedRoute allowedRoles={["student"]}>
      {onDashboardRoot ? (
        <DashboardLayout>
          <StudentDashboard />
        </DashboardLayout>
      ) : (
        <Outlet />
      )}
    </ProtectedRoute>
  );
}

function StudentDashboard() {
  const { user } = useAuth();

  const enrollments = useQuery({
    queryKey: ["student-enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select("course:courses(id, course_code, course_name)")
        .eq("student_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const attendance = useQuery({
    queryKey: ["student-attendance", user?.matric_number],
    enabled: !!user?.matric_number,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("id, method, logged_at, raw_time, time_synced, course_id, course:courses(course_code, course_name)")
        .eq("matric_number", user!.matric_number!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = attendance.data?.length ?? 0;
  const synced = attendance.data?.filter((a) => a.time_synced).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.full_name?.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">{user?.matric_number}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={BookOpen} label="Enrolled courses" value={enrollments.data?.length ?? 0} />
        <StatCard icon={CheckCircle2} label="Total check-ins" value={total} tone="success" />
        <StatCard icon={Clock} label="Synced records" value={synced} tone="accent" />
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
        <StudentQrScanner />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How to check in</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>Option A — Biometric (2FA):</strong> Tap your enrolled RFID card on the AttendESP device, then place your finger on the fingerprint sensor.</p>
            <p><strong>Option B — QR + Bluetooth:</strong> Open the scanner here, scan the QR shown on the AttendESP OLED, then approve the Bluetooth pairing prompt. The device confirms your presence and records you as present.</p>
            <p className="text-xs">Bluetooth check-in needs Chrome or Edge on Android. iPhones must use Option A.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Courses</CardTitle>
          <p className="text-xs text-muted-foreground">
            Open your enrolled courses and inspect attendance per course.
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/student/courses">Open Courses</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My attendance history</CardTitle>
          <p className="text-xs text-muted-foreground">
            Records uploaded by your classroom's AttendESP device.
          </p>
        </CardHeader>
        <CardContent>
          {attendance.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (attendance.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attendance recorded yet. Check in at the AttendESP device in class.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.data!.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">
                      {formatLoggedAt(a.logged_at, a.raw_time)}
                    </TableCell>
                    <TableCell>
                      {a.course?.course_code ? (
                        <span>
                          <span className="font-medium">{a.course.course_code}</span>{" "}
                          <span className="text-xs text-muted-foreground">{a.course.course_name}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unmatched</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.method === "2FA" ? "default" : "secondary"}>
                        {a.method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {a.time_synced ? (
                        <Badge variant="outline" className="border-green-500 text-green-700">
                          Present
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500 text-amber-700">
                          Pending sync
                        </Badge>
                      )}
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

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number | string;
  tone?: "success" | "accent";
}) {
  const color =
    tone === "success" ? "text-green-600" : tone === "accent" ? "text-accent" : "text-primary";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}
