import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLoggedAt } from "@/lib/time";

export const Route = createFileRoute("/student/courses")({
  component: () => (
    <ProtectedRoute allowedRoles={["student"]}>
      <DashboardLayout>
        <StudentCoursesPage />
      </DashboardLayout>
    </ProtectedRoute>
  ),
});

type CourseRow = {
  id: string;
  course_code: string;
  course_name: string;
};

type AttendanceRow = {
  id: string;
  method: string | null;
  logged_at: string | null;
  raw_time: string | null;
  time_synced: boolean;
  course_id: string | null;
};

function StudentCoursesPage() {
  const { user } = useAuth();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const enrollments = useQuery({
    queryKey: ["student-enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select("course:courses(id, course_code, course_name)")
        .eq("student_id", user!.id);
      if (error) throw error;
      const rows = (data ?? [])
        .map((entry: any) => entry.course as CourseRow | null)
        .filter((course: CourseRow | null): course is CourseRow => !!course)
        .sort((left, right) => left.course_code.localeCompare(right.course_code));
      return rows;
    },
  });

  const attendance = useQuery({
    queryKey: ["student-attendance", user?.matric_number],
    enabled: !!user?.matric_number,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("id, method, logged_at, raw_time, time_synced, course_id")
        .eq("matric_number", user!.matric_number!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });

  useEffect(() => {
    if (selectedCourseId) return;
    const firstCourseId = enrollments.data?.[0]?.id ?? null;
    if (firstCourseId) setSelectedCourseId(firstCourseId);
  }, [enrollments.data, selectedCourseId]);

  const totalsByCourse = useMemo(() => {
    const map = new Map<string, { total: number; latest: string | null }>();
    for (const row of attendance.data ?? []) {
      if (!row.course_id) continue;
      const current = map.get(row.course_id) ?? { total: 0, latest: null };
      current.total += 1;
      const stamp = row.logged_at ?? row.raw_time ?? null;
      if (stamp && (!current.latest || new Date(stamp).getTime() > new Date(current.latest).getTime())) {
        current.latest = stamp;
      }
      map.set(row.course_id, current);
    }
    return map;
  }, [attendance.data]);

  const selectedCourse = useMemo(
    () => (enrollments.data ?? []).find((course) => course.id === selectedCourseId) ?? null,
    [enrollments.data, selectedCourseId],
  );

  const selectedRows = useMemo(
    () => (attendance.data ?? []).filter((row) => row.course_id === selectedCourseId),
    [attendance.data, selectedCourseId],
  );

  const selectedStats = useMemo(() => {
    let twoFactor = 0;
    let qrBle = 0;
    for (const row of selectedRows) {
      const normalized = (row.method ?? "").toUpperCase();
      if (normalized === "2FA") twoFactor += 1;
      if (normalized === "QR_BLE") qrBle += 1;
    }
    const latest = selectedRows[0]?.logged_at ?? selectedRows[0]?.raw_time ?? null;
    return {
      total: selectedRows.length,
      twoFactor,
      qrBle,
      latest,
      synced: selectedRows.filter((row) => !!row.time_synced).length,
    };
  }, [selectedRows]);

  const loading = enrollments.isLoading || attendance.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Courses</h1>
        <p className="text-sm text-muted-foreground">Select an enrolled course to view your attendance details.</p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading courses…</CardContent>
        </Card>
      ) : (enrollments.data?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">You are not enrolled in any courses yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enrolled courses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(enrollments.data ?? []).map((course) => {
                const totals = totalsByCourse.get(course.id) ?? { total: 0, latest: null as string | null };
                const active = selectedCourseId === course.id;
                return (
                  <Button
                    key={course.id}
                    variant={active ? "default" : "outline"}
                    className="h-auto w-full justify-between py-3"
                    onClick={() => setSelectedCourseId(course.id)}
                  >
                    <span className="text-left">
                      <span className="block font-semibold">{course.course_code}</span>
                      <span className="block text-xs opacity-80">{course.course_name}</span>
                    </span>
                    <Badge variant="secondary">{totals.total}</Badge>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedCourse ? `${selectedCourse.course_code} attendance` : "Course attendance"}
                </CardTitle>
                {selectedCourse && (
                  <p className="text-xs text-muted-foreground">{selectedCourse.course_name}</p>
                )}
              </CardHeader>
              <CardContent>
                {!selectedCourse ? (
                  <p className="text-sm text-muted-foreground">Choose a course from the left to continue.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatPill label="Total" value={selectedStats.total} />
                    <StatPill label="2FA" value={selectedStats.twoFactor} />
                    <StatPill label="QR + BLE" value={selectedStats.qrBle} />
                    <StatPill label="Synced" value={selectedStats.synced} />
                    <StatPill
                      label="Last check-in"
                      value={selectedStats.latest ? formatLoggedAt(selectedStats.latest, null) : "—"}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attendance records</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedCourse ? (
                  <p className="text-sm text-muted-foreground">Choose a course to view records.</p>
                ) : selectedRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attendance records found for this course yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs">{formatLoggedAt(row.logged_at, row.raw_time)}</TableCell>
                          <TableCell>
                            <Badge variant={row.method === "2FA" ? "default" : "secondary"}>{row.method ?? "—"}</Badge>
                          </TableCell>
                          <TableCell>
                            {row.time_synced ? (
                              <Badge variant="outline" className="border-green-500 text-green-700">Present</Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-500 text-amber-700">Pending sync</Badge>
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
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-1">{value}</p>
    </div>
  );
}
