import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { DAYS } from "@/lib/time";
import { Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/course-rep/timetable")({
  component: () => (
    <ProtectedRoute allowedRoles={["course_rep"]}>
      <DashboardLayout>
        <Timetable />
      </DashboardLayout>
    </ProtectedRoute>
  ),
});

function Timetable() {
  const qc = useQueryClient();

  const schedulesQuery = useQuery({
    queryKey: ["timetable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("id, day_of_week, start_time, end_time, venue, device_id, course_id, course:courses(course_code, course_name)")
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        venue: string | null;
        device_id: string | null;
        course_id: string;
        course: { course_code: string; course_name: string } | null;
      }>;
    },
  });

  const coursesQuery = useQuery({
    queryKey: ["all-courses-for-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, course_code, course_name").order("course_code");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; course_code: string; course_name: string }>;
    },
  });

  const loading = schedulesQuery.isLoading || coursesQuery.isLoading;
  const error = schedulesQuery.error || coursesQuery.error;

  const byDay = useMemo(
    () => DAYS.map((day, index) => ({
      day,
      dayIndex: index,
      items: (schedulesQuery.data ?? []).filter((schedule) => schedule.day_of_week === index),
    })),
    [schedulesQuery.data],
  );

  async function deleteSchedule(scheduleId: string) {
    const shouldDelete = window.confirm("Delete this timetable entry?");
    if (!shouldDelete) return;

    const { error: deleteError } = await supabase.from("schedules").delete().eq("id", scheduleId);
    if (deleteError) {
      toast.error("Failed to delete schedule", { description: deleteError.message });
      return;
    }

    toast.success("Schedule deleted");
    qc.invalidateQueries({ queryKey: ["timetable"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Weekly timetable</h1>
          <p className="text-sm text-muted-foreground">Create and manage class schedules in WAT time.</p>
        </div>
        <ScheduleDialog
          mode="create"
          courses={coursesQuery.data ?? []}
          onDone={() => qc.invalidateQueries({ queryKey: ["timetable"] })}
        />
      </div>

      {loading && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load timetable. Please refresh the page.
        </div>
      )}

      {!loading && !error && (schedulesQuery.data?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No schedule entries yet.</CardContent>
        </Card>
      )}

      {!loading && !error && (schedulesQuery.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Time (WAT)</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead className="w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(schedulesQuery.data ?? []).map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>{DAYS[schedule.day_of_week]}</TableCell>
                      <TableCell>
                        {schedule.course?.course_code ?? "-"}
                        <span className="ml-1 text-xs text-muted-foreground">{schedule.course?.course_name ?? ""}</span>
                      </TableCell>
                      <TableCell>
                        {String(schedule.start_time).slice(0, 5)}-{String(schedule.end_time).slice(0, 5)}
                      </TableCell>
                      <TableCell>{schedule.venue ?? "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{schedule.device_id ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <ScheduleDialog
                            mode="edit"
                            courses={coursesQuery.data ?? []}
                            schedule={schedule}
                            onDone={() => qc.invalidateQueries({ queryKey: ["timetable"] })}
                          />
                          <Button size="sm" variant="destructive" onClick={() => deleteSchedule(schedule.id)}>
                            <Trash2 className="mr-1 h-4 w-4" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {byDay.map((group) => (
            <Card key={group.day}>
              <CardHeader>
                <CardTitle className="text-base">{group.day}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No classes</p>
                ) : (
                  group.items.map((item) => (
                    <div key={item.id} className="rounded-md border p-2 text-xs">
                      <div className="font-semibold">{item.course?.course_code ?? "Unknown"}</div>
                      <div className="text-muted-foreground">
                        {String(item.start_time).slice(0, 5)}-{String(item.end_time).slice(0, 5)}
                      </div>
                      <div className="text-muted-foreground">{item.venue ?? "-"} | {item.device_id ?? "-"}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleDialog({
  mode,
  courses,
  schedule,
  onDone,
}: {
  mode: "create" | "edit";
  courses: Array<{ id: string; course_code: string; course_name: string }>;
  schedule?: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    venue: string | null;
    device_id: string | null;
    course_id: string;
  };
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(schedule?.course_id ?? "");
  const [day, setDay] = useState(String(schedule?.day_of_week ?? 1));
  const [start, setStart] = useState(String(schedule?.start_time ?? "09:00:00").slice(0, 5));
  const [end, setEnd] = useState(String(schedule?.end_time ?? "11:00:00").slice(0, 5));
  const [venue, setVenue] = useState(schedule?.venue ?? "");
  const [device, setDevice] = useState(schedule?.device_id ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!courseId) {
      toast.error("Please choose a course");
      return;
    }

    if (!start || !end || start >= end) {
      toast.error("End time must be after start time");
      return;
    }

    const payload = {
      course_id: courseId,
      day_of_week: Number(day),
      start_time: `${start}:00`,
      end_time: `${end}:00`,
      venue: venue.trim() || null,
      device_id: device.trim() || null,
    };

    setBusy(true);

    if (mode === "create") {
      const { error } = await supabase.from("schedules").insert(payload);
      setBusy(false);

      if (error) {
        toast.error("Failed to create schedule", { description: error.message });
        return;
      }

      toast.success("Schedule created");
    } else {
      const { error } = await supabase.from("schedules").update(payload).eq("id", schedule!.id);
      setBusy(false);

      if (error) {
        toast.error("Failed to update schedule", { description: error.message });
        return;
      }

      toast.success("Schedule updated");
    }

    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add schedule
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create schedule" : "Edit schedule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.course_code} - {course.course_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Day</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((name, index) => (
                  <SelectItem key={name} value={String(index)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start (WAT)</Label>
              <Input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End (WAT)</Label>
              <Input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Venue</Label>
            <Input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="e.g. LT101" />
          </div>
          <div className="space-y-1">
            <Label>Device ID</Label>
            <Input value={device} onChange={(event) => setDevice(event.target.value)} placeholder="e.g. ESP32-LT101" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving..." : mode === "create" ? "Create" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
