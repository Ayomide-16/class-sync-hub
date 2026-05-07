import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { DAYS } from "@/lib/time";
import { BookOpen, Users, Calendar, Plus } from "lucide-react";

export const Route = createFileRoute("/course-rep")({
  component: CourseRepRoute,
});

function CourseRepRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onDashboardRoot = pathname === "/course-rep" || pathname === "/course-rep/";

  return (
    <ProtectedRoute allowedRoles={["course_rep"]}>
      {onDashboardRoot ? (
        <DashboardLayout>
          <CourseRepDashboard />
        </DashboardLayout>
      ) : (
        <Outlet />
      )}
    </ProtectedRoute>
  );
}

function CourseRepDashboard() {
  const qc = useQueryClient();
  const courses = useQuery({
    queryKey: ["all-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, course_code, course_name, lecturer_id, schedules(id, day_of_week, start_time, end_time, venue, device_id), course_enrollments(id)")
        .order("course_code");
      if (error) throw error;

      const courseRows = (data ?? []) as Array<{
        id: string;
        course_code: string;
        course_name: string;
        lecturer_id: string | null;
        schedules: Array<{
          id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          venue: string | null;
          device_id: string | null;
        }>;
        course_enrollments: Array<{ id: string }>;
      }>;

      const lecturerIds = Array.from(new Set(courseRows.map((course) => course.lecturer_id).filter(Boolean))) as string[];
      const lecturersResult = lecturerIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, matric_number")
            .in("id", lecturerIds)
        : { data: [], error: null };

      if (lecturersResult.error) throw lecturersResult.error;

      const lecturerMap = new Map((lecturersResult.data ?? []).map((lecturer) => [lecturer.id, lecturer]));

      return courseRows.map((course) => ({
        ...course,
        lecturer: course.lecturer_id ? lecturerMap.get(course.lecturer_id) ?? null : null,
      }));
    },
  });

  const lecturers = useQuery({
    queryKey: ["all-lecturers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "lecturer");
      if (error) throw error;

      const lecturerIds = Array.from(new Set((data ?? []).map((row) => row.user_id).filter(Boolean)));
      const profilesResult = lecturerIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, matric_number")
            .in("id", lecturerIds)
        : { data: [], error: null };

      if (profilesResult.error) throw profilesResult.error;
      return profilesResult.data ?? [];
    },
  });

  const studentsCount = useQuery({
    queryKey: ["students-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "student");
      return count ?? 0;
    },
  });

  const totalSchedules = (courses.data ?? []).reduce(
    (n: number, c: any) => n + (c.schedules?.length ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Course Rep Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage courses, schedules, and enrollment.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={BookOpen} label="Courses" value={courses.data?.length ?? 0} />
        <Stat icon={Users} label="Students" value={studentsCount.data ?? 0} />
        <Stat icon={Calendar} label="Schedules" value={totalSchedules} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Courses</CardTitle>
          <NewCourseDialog
            lecturers={lecturers.data ?? []}
            onDone={() => qc.invalidateQueries({ queryKey: ["all-courses"] })}
          />
        </CardHeader>
        <CardContent>
          {courses.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-3">
              {(courses.data ?? []).map((c: any) => (
                <CourseRow
                  key={c.id}
                  course={c}
                  onChange={() => qc.invalidateQueries({ queryKey: ["all-courses"] })}
                />
              ))}
              {courses.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">No courses yet. Create one above.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="h-6 w-6 text-primary" />
      </CardContent>
    </Card>
  );
}

function CourseRow({ course, onChange }: { course: any; onChange: () => void }) {
  return (
    <div className="border rounded-md p-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium">
            {course.course_code}{" "}
            <span className="font-normal text-muted-foreground">— {course.course_name}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Lecturer: {course.lecturer?.full_name ?? "Unassigned"} ·{" "}
            {course.course_enrollments?.length ?? 0} students
          </div>
        </div>
        <NewScheduleDialog courseId={course.id} onDone={onChange} />
      </div>
      {(course.schedules ?? []).length > 0 && (
        <div className="mt-3 text-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {course.schedules.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{DAYS[s.day_of_week]}</TableCell>
                  <TableCell>
                    {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)}
                  </TableCell>
                  <TableCell>{s.venue ?? "—"}</TableCell>
                  <TableCell className="font-mono">{s.device_id ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function NewCourseDialog({ lecturers, onDone }: { lecturers: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [lecturerId, setLecturerId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!code || !name) return toast.error("Course code and name are required");
    setBusy(true);
    const { error } = await supabase.from("courses").insert({
      course_code: code.trim().toUpperCase(),
      course_name: name.trim(),
      lecturer_id: lecturerId || null,
    });
    setBusy(false);
    if (error) return toast.error("Failed to create course", { description: error.message });
    toast.success("Course created");
    setCode(""); setName(""); setLecturerId("");
    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />New course</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create course</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Course code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ENG302" />
          </div>
          <div className="space-y-1">
            <Label>Course name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering Mathematics III" />
          </div>
          <div className="space-y-1">
            <Label>Assign lecturer (optional)</Label>
            <Select value={lecturerId} onValueChange={setLecturerId}>
              <SelectTrigger><SelectValue placeholder="Select a lecturer" /></SelectTrigger>
              <SelectContent>
                {lecturers.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.full_name} ({l.matric_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewScheduleDialog({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string>("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("11:00");
  const [venue, setVenue] = useState("LT101");
  const [device, setDevice] = useState("ESP32-LT101");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const { error } = await supabase.from("schedules").insert({
      course_id: courseId,
      day_of_week: Number(day),
      start_time: start + ":00",
      end_time: end + ":00",
      venue,
      device_id: device,
    });
    setBusy(false);
    if (error) return toast.error("Failed to create schedule", { description: error.message });
    toast.success("Schedule added");
    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Schedule</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add schedule</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Day of week</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start (WAT)</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End (WAT)</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Venue</Label>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Device ID</Label>
            <Input value={device} onChange={(e) => setDevice(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>Add schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
