import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/course-rep/students")({
  component: () => (
    <ProtectedRoute allowedRoles={["course_rep"]}>
      <DashboardLayout>
        <Students />
      </DashboardLayout>
    </ProtectedRoute>
  ),
});

function Students() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const studentsQuery = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (error) throw error;

      const studentIds = Array.from(new Set((data ?? []).map((row) => row.user_id).filter(Boolean)));

      const profilesResult = studentIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, matric_number, rfid_card_id, fingerprint_id")
            .in("id", studentIds)
        : { data: [], error: null };

      if (profilesResult.error) throw profilesResult.error;

      const profileMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));

      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("course_enrollments")
        .select("student_id");

      if (enrollmentsError) throw enrollmentsError;

      const enrollmentCounts = (enrollments ?? []).reduce((acc, row) => {
        acc[row.student_id] = (acc[row.student_id] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return (data ?? [])
        .map((row) => {
          const profile = profileMap.get(row.user_id);
          if (!profile) return null;

          return {
            id: profile.id,
            user_id: row.user_id,
            full_name: profile.full_name,
            matric_number: profile.matric_number,
            rfid_card_id: profile.rfid_card_id,
            fingerprint_id: profile.fingerprint_id,
            enrollment_count: enrollmentCounts[row.user_id] ?? 0,
          };
        })
        .filter((student): student is {
          id: string;
          user_id: string;
          full_name: string;
          matric_number: string | null;
          rfid_card_id: string | null;
          fingerprint_id: number | null;
          enrollment_count: number;
        } => !!student);
    },
  });

  const loading = studentsQuery.isLoading;
  const error = studentsQuery.error;

  const filtered = useMemo(() => (studentsQuery.data ?? []).filter((student) => {
    const term = q.toLowerCase();
    return (
      student.full_name?.toLowerCase().includes(term) ||
      student.matric_number?.toLowerCase().includes(term)
    );
  }), [studentsQuery.data, q]);

  async function deleteStudent(studentId: string) {
    const shouldDelete = window.confirm("Delete this student account? This removes the login and related enrollments.");
    if (!shouldDelete) return;

    const { data, error: functionError } = await supabase.functions.invoke("admin-students", {
      body: { action: "delete", student_id: studentId },
    });

    if (functionError || data?.error) {
      toast.error("Failed to delete student", {
        description: functionError?.message || String(data?.error || "Unknown error"),
      });
      return;
    }

    toast.success("Student deleted");
    qc.invalidateQueries({ queryKey: ["all-students"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>
          <p className="text-sm text-muted-foreground">Manage students, credentials, and enrollment readiness.</p>
        </div>
        <AddStudentDialog onDone={() => qc.invalidateQueries({ queryKey: ["all-students"] })} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{studentsQuery.data?.length ?? 0} students</CardTitle>
          <Input
            placeholder="Search by name or matric..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load students. Please refresh the page.
            </div>
          )}

          {!loading && !error && filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students match your search.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Matric</TableHead>
                  <TableHead>Enrollments</TableHead>
                  <TableHead>RFID</TableHead>
                  <TableHead>Fingerprint</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell className="font-mono text-xs">{student.matric_number ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{student.enrollment_count}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{student.rfid_card_id ?? "-"}</TableCell>
                    <TableCell>{student.fingerprint_id ?? "-"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="destructive" onClick={() => deleteStudent(student.user_id)}>
                        <Trash2 className="mr-1 h-4 w-4" /> Delete
                      </Button>
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

function AddStudentDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!fullName.trim() || !matricNumber.trim()) {
      toast.error("Full name and matric number are required");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-students", {
      body: {
        action: "create",
        full_name: fullName.trim(),
        matric_number: matricNumber.trim().toUpperCase(),
        password: password.trim() || undefined,
      },
    });
    setBusy(false);

    if (error || data?.error) {
      toast.error("Failed to create student", {
        description: error?.message || String(data?.error || "Unknown error"),
      });
      return;
    }

    toast.success("Student created", {
      description: `Login email: ${data.email}`,
    });

    setFullName("");
    setMatricNumber("");
    setPassword("");
    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add student
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create student account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Musa Ibrahim" />
          </div>
          <div className="space-y-1">
            <Label>Matric number</Label>
            <Input value={matricNumber} onChange={(event) => setMatricNumber(event.target.value)} placeholder="e.g. 2019/1/12345CT" />
          </div>
          <div className="space-y-1">
            <Label>Password (optional)</Label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Leave blank to auto-generate"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Creating..." : "Create student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
