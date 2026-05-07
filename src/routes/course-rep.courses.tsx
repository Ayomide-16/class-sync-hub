import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/course-rep/courses")({
  component: () => (
    <ProtectedRoute allowedRoles={["course_rep"]}>
      <DashboardLayout>
        <CoursesList />
      </DashboardLayout>
    </ProtectedRoute>
  ),
});

function CoursesList() {
  const qc = useQueryClient();

  const coursesQuery = useQuery({
    queryKey: ["all-courses-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, course_code, course_name, lecturer_id, schedules(id), course_enrollments(id)")
        .order("course_code");
      if (error) throw error;

      const courseRows = (data ?? []) as Array<{
        id: string;
        course_code: string;
        course_name: string;
        lecturer_id: string | null;
        schedules: Array<{ id: string }> | null;
        course_enrollments: Array<{ id: string }> | null;
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

  const lecturersQuery = useQuery({
    queryKey: ["all-lecturers-list"],
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

      return (profilesResult.data ?? []).map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        matric_number: profile.matric_number,
      }));
    },
  });

  const rows = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const loading = coursesQuery.isLoading || lecturersQuery.isLoading;
  const error = coursesQuery.error || lecturersQuery.error;

  async function deleteCourse(courseId: string) {
    const shouldDelete = window.confirm("Delete this course? Related schedules and enrollments will also be removed.");
    if (!shouldDelete) return;

    const { error: deleteError } = await supabase.from("courses").delete().eq("id", courseId);
    if (deleteError) {
      toast.error("Failed to delete course", { description: deleteError.message });
      return;
    }

    toast.success("Course deleted");
    qc.invalidateQueries({ queryKey: ["all-courses-list"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-sm text-muted-foreground">Create, update, assign lecturers, and remove courses.</p>
        </div>
        <CourseDialog
          mode="create"
          lecturers={lecturersQuery.data ?? []}
          onDone={() => qc.invalidateQueries({ queryKey: ["all-courses-list"] })}
        />
      </div>

      {loading && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load courses. Please refresh the page.
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No courses yet. Create one to get started.</CardContent>
        </Card>
      )}

      {!loading && !error && rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Course list</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Lecturer</TableHead>
                    <TableHead>Stats</TableHead>
                    <TableHead className="w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-semibold">{course.course_code}</TableCell>
                      <TableCell>{course.course_name}</TableCell>
                      <TableCell>
                        {course.lecturer?.full_name ?? "Unassigned"}
                        {course.lecturer?.matric_number ? (
                          <span className="ml-2 text-xs text-muted-foreground">({course.lecturer.matric_number})</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary">{course.course_enrollments?.length ?? 0} students</Badge>
                          <Badge variant="outline">{course.schedules?.length ?? 0} schedules</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <CourseDialog
                            mode="edit"
                            lecturers={lecturersQuery.data ?? []}
                            course={course}
                            onDone={() => qc.invalidateQueries({ queryKey: ["all-courses-list"] })}
                          />
                          <Button size="sm" variant="destructive" onClick={() => deleteCourse(course.id)}>
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
    </div>
  );
}

function CourseDialog({
  mode,
  lecturers,
  course,
  onDone,
}: {
  mode: "create" | "edit";
  lecturers: Array<{ id: string; full_name: string; matric_number: string | null }>;
  course?: {
    id: string;
    course_code: string;
    course_name: string;
    lecturer_id: string | null;
  };
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(course?.course_code ?? "");
  const [name, setName] = useState(course?.course_name ?? "");
  const [lecturerId, setLecturerId] = useState(course?.lecturer_id ?? "none");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!code.trim() || !name.trim()) {
      toast.error("Course code and name are required");
      return;
    }

    setBusy(true);

    if (mode === "create") {
      const { error } = await supabase.from("courses").insert({
        course_code: code.trim().toUpperCase(),
        course_name: name.trim(),
        lecturer_id: lecturerId === "none" ? null : lecturerId,
      });

      setBusy(false);
      if (error) {
        toast.error("Failed to create course", { description: error.message });
        return;
      }

      toast.success("Course created");
    } else {
      const { error } = await supabase
        .from("courses")
        .update({
          course_code: code.trim().toUpperCase(),
          course_name: name.trim(),
          lecturer_id: lecturerId === "none" ? null : lecturerId,
        })
        .eq("id", course!.id);

      setBusy(false);
      if (error) {
        toast.error("Failed to update course", { description: error.message });
        return;
      }

      toast.success("Course updated");
    }

    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> New course
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create course" : "Edit course"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Course code</Label>
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. CSC301" />
          </div>
          <div className="space-y-1">
            <Label>Course name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Database Systems" />
          </div>
          <div className="space-y-1">
            <Label>Assigned lecturer</Label>
            <Select value={lecturerId} onValueChange={setLecturerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose lecturer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {lecturers.map((lecturer) => (
                  <SelectItem key={lecturer.id} value={lecturer.id}>
                    {lecturer.full_name}
                    {lecturer.matric_number ? ` (${lecturer.matric_number})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
