import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  buildCsv,
  buildXlsxBlob,
  downloadBlob,
  formatWatDateKey,
  formatWatDateShort,
  formatWatDayShort,
  formatWatTime,
  sanitizeFileName,
} from "@/lib/spreadsheet-export";

type CourseRow = {
  id: string;
  course_code: string;
  course_name: string;
};

type EnrollmentRow = { student_id: string };

type ProfileRow = {
  id: string;
  full_name: string;
  matric_number: string | null;
};

type AttendanceRow = {
  id: string;
  student_id: string | null;
  matric_number: string;
  student_name: string;
  method: string;
  logged_at: string | null;
  raw_time: string | null;
  schedule_id: string | null;
  course_id: string | null;
  time_synced: boolean;
};

type ScheduleRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  venue: string | null;
};

type SessionColumn = {
  key: string;
  label: string;
  sortValue: number;
};

export const Route = createFileRoute("/lecturer/courses")({
  component: () => (
    <ProtectedRoute allowedRoles={["lecturer"]}>
      <DashboardLayout>
        <LecturerCourses />
      </DashboardLayout>
    </ProtectedRoute>
  ),
});

function LecturerCourses() {
  const { user } = useAuth();
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [downloadKind, setDownloadKind] = useState<"csv" | "xlsx" | null>(null);

  const coursesQuery = useQuery({
    queryKey: ["lecturer-courses-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, course_code, course_name")
        .eq("lecturer_id", user!.id)
        .order("course_code");
      if (error) throw error;
      return (data ?? []) as CourseRow[];
    },
  });

  useEffect(() => {
    if (!selectedCourseId && coursesQuery.data?.length) {
      setSelectedCourseId(coursesQuery.data[0].id);
    }
  }, [coursesQuery.data, selectedCourseId]);

  const activeCourseId = selectedCourseId || coursesQuery.data?.[0]?.id || "";

  const sheetQuery = useQuery({
    queryKey: ["lecturer-attendance-sheet", activeCourseId],
    enabled: !!activeCourseId,
    queryFn: async () => {
      const courseResult = await supabase
        .from("courses")
        .select("id, course_code, course_name")
        .eq("id", activeCourseId)
        .maybeSingle();

      if (courseResult.error) throw courseResult.error;

      const enrollmentsResult = await supabase
        .from("course_enrollments")
        .select("student_id")
        .eq("course_id", activeCourseId);

      if (enrollmentsResult.error) throw enrollmentsResult.error;

      const studentIds = Array.from(new Set((enrollmentsResult.data ?? []).map((row) => row.student_id)));

      const profilesResult = studentIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, matric_number")
            .in("id", studentIds)
        : { data: [], error: null };

      if (profilesResult.error) throw profilesResult.error;

      const [schedulesResult, attendanceResult] = await Promise.all([
        supabase
          .from("schedules")
          .select("id, day_of_week, start_time, end_time, venue")
          .eq("course_id", activeCourseId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("attendance_logs")
          .select("id, student_id, matric_number, student_name, method, logged_at, raw_time, schedule_id, course_id, time_synced")
          .eq("course_id", activeCourseId)
          .order("logged_at", { ascending: true }),
      ]);

      if (schedulesResult.error) throw schedulesResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      return {
        course: courseResult.data as CourseRow | null,
        enrollments: (enrollmentsResult.data ?? []) as EnrollmentRow[],
        profiles: (profilesResult.data ?? []) as ProfileRow[],
        schedules: (schedulesResult.data ?? []) as ScheduleRow[],
        attendance: (attendanceResult.data ?? []) as AttendanceRow[],
      };
    },
  });

  const enrolledStudents = useMemo(() => {
    const profileMap = new Map(sheetQuery.data?.profiles.map((profile) => [profile.id, profile]) ?? []);

    return (sheetQuery.data?.enrollments ?? [])
      .map((enrollment) => profileMap.get(enrollment.student_id))
      .filter((profile): profile is ProfileRow => !!profile)
      .sort((left, right) => {
        const leftSurname = surname(left.full_name);
        const rightSurname = surname(right.full_name);
        return leftSurname.localeCompare(rightSurname) || left.full_name.localeCompare(right.full_name);
      });
  }, [sheetQuery.data]);

  const sessions = useMemo(() => {
    const scheduleMap = new Map(sheetQuery.data?.schedules.map((schedule) => [schedule.id, schedule]) ?? []);
    const columns = new Map<string, SessionColumn>();

    for (const record of sheetQuery.data?.attendance ?? []) {
      if (!record.logged_at) continue;
      const dateKey = formatWatDateKey(record.logged_at);
      const key = `${record.schedule_id ?? "unscheduled"}::${dateKey}`;

      if (!columns.has(key)) {
        const schedule = record.schedule_id ? scheduleMap.get(record.schedule_id) : null;
        const sortValue = new Date(record.logged_at).getTime();
        const label = `${formatWatDayShort(record.logged_at)} ${formatWatDateShort(record.logged_at)} ${schedule?.start_time ? String(schedule.start_time).slice(0, 5) : formatWatTime(record.logged_at)}`;
        columns.set(key, { key, label, sortValue });
      }
    }

    return [...columns.values()].sort((left, right) => left.sortValue - right.sortValue);
  }, [sheetQuery.data]);

  const rows = useMemo(() => {
    const attendanceBySession = new Map<string, AttendanceRow>();

    for (const record of sheetQuery.data?.attendance ?? []) {
      if (!record.logged_at) continue;
      const dateKey = formatWatDateKey(record.logged_at);
      const key = `${record.schedule_id ?? "unscheduled"}::${dateKey}::${record.student_id ?? record.matric_number}`;
      attendanceBySession.set(key, record);
    }

    return enrolledStudents.map((student) => {
      const values = sessions.map((session) => {
        const matched = attendanceBySession.get(`${session.key}::${student.id}`)
          || (sheetQuery.data?.attendance ?? []).find((record) => {
            if (!record.logged_at) return false;
            const dateKey = formatWatDateKey(record.logged_at);
            const recordKey = `${record.schedule_id ?? "unscheduled"}::${dateKey}::${record.student_id ?? record.matric_number}`;
            return recordKey === `${session.key}::${student.id}`;
          });

        return matched ? normalizeMethod(matched.method) : "A";
      });

      const presentCount = values.filter((value) => value !== "A").length;
      const total = sessions.length;
      const percentage = total === 0 ? 0 : Math.round((presentCount / total) * 100);

      return {
        ...student,
        values,
        presentCount,
        total,
        percentage,
      };
    });
  }, [enrolledStudents, sessions, sheetQuery.data]);

  const exportRows = useMemo(() => {
    const header = [
      "Student Name",
      "Matric Number",
      ...sessions.map((session) => session.label),
      "Present / Total",
      "Percentage",
    ];

    const body = rows.map((row) => [
      row.full_name,
      row.matric_number ?? "",
      ...row.values,
      `${row.presentCount}/${row.total}`,
      `${row.percentage}%`,
    ]);

    return [header, ...body];
  }, [rows, sessions]);

  const currentCourse = sheetQuery.data?.course ?? coursesQuery.data?.[0] ?? null;

  function todayStamp() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function exportCsv() {
    if (!currentCourse) return;
    const blob = new Blob([buildCsv(exportRows)], { type: "text/csv;charset=utf-8" });
    downloadBlob(`AttendClass_${sanitizeFileName(currentCourse.course_code)}_Attendance_${todayStamp()}.csv`, blob);
  }

  function exportXlsx() {
    if (!currentCourse) return;
    const blob = buildXlsxBlob(`${currentCourse.course_code} Attendance`, exportRows);
    downloadBlob(`AttendClass_${sanitizeFileName(currentCourse.course_code)}_Attendance_${todayStamp()}.xlsx`, blob);
  }

  async function handleExport(kind: "csv" | "xlsx") {
    try {
      setDownloadKind(kind);
      if (kind === "csv") exportCsv();
      else exportXlsx();
    } catch {
      toast.error(`Failed to download ${kind.toUpperCase()}.`);
    } finally {
      setDownloadKind(null);
    }
  }

  const loading = coursesQuery.isLoading || sheetQuery.isLoading;
  const error = coursesQuery.error || sheetQuery.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Courses</h1>
          <p className="text-sm text-muted-foreground">Attendance spreadsheet for each course.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleExport("csv")} disabled={!exportRows.length || !!downloadKind}>
            {downloadKind === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download CSV
          </Button>
          <Button onClick={() => handleExport("xlsx")} disabled={!exportRows.length || !!downloadKind}>
            {downloadKind === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download XLSX
          </Button>
        </div>
      </div>

      {(coursesQuery.data?.length ?? 0) > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="max-w-sm space-y-2">
              <p className="text-sm font-medium">Course selector</p>
              <Select value={activeCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {(coursesQuery.data ?? []).map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load attendance data. Please refresh the page.
        </div>
      )}

      {!loading && !error && coursesQuery.data?.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No courses assigned to you yet.</CardContent>
        </Card>
      )}

      {!loading && !error && currentCourse && (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg">
                {currentCourse.course_code} - {currentCourse.course_name}
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary">{enrolledStudents.length} students</Badge>
                <Badge variant="outline">{sessions.length} sessions</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="rounded-md border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                No sessions recorded yet.
              </div>
            ) : enrolledStudents.length === 0 ? (
              <div className="rounded-md border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                No enrolled students yet for this course.
              </div>
            ) : (
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-background">Student Name</TableHead>
                      <TableHead className="sticky left-[220px] z-10 bg-background">Matric Number</TableHead>
                      {sessions.map((session) => (
                        <TableHead key={session.key} className="whitespace-nowrap">
                          {session.label}
                        </TableHead>
                      ))}
                      <TableHead>Present / Total</TableHead>
                      <TableHead>%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">{row.full_name}</TableCell>
                        <TableCell className="sticky left-[220px] z-10 bg-background font-mono text-xs">
                          {row.matric_number ?? "—"}
                        </TableCell>
                        {row.values.map((value, index) => (
                          <TableCell key={`${row.id}-${index}`} className="font-semibold">
                            {value}
                          </TableCell>
                        ))}
                        <TableCell>{row.presentCount}/{row.total}</TableCell>
                        <TableCell>{row.percentage}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function normalizeMethod(method: string) {
  const value = method.toUpperCase();
  if (value === "2FA" || value === "QR_BLE") return value;
  return method || "P";
}

function surname(fullName: string) {
  return fullName.trim().split(/\s+/).at(-1) ?? fullName;
}
