import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState } from "react";

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
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("profiles!inner(id, full_name, matric_number, rfid_card_id, fingerprint_id)")
        .eq("role", "student");
      if (error) throw error;
      return (data ?? []).map((r: any) => r.profiles);
    },
  });

  const filtered = (data ?? []).filter((s: any) => {
    const term = q.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(term) ||
      s.matric_number?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Students</h1>
      <Card>
        <CardHeader>
          <CardTitle>{data?.length ?? 0} students</CardTitle>
          <Input
            placeholder="Search by name or matric…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Matric</TableHead>
                  <TableHead>RFID</TableHead>
                  <TableHead>Fingerprint</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.full_name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.matric_number}</TableCell>
                    <TableCell className="font-mono text-xs">{s.rfid_card_id ?? "—"}</TableCell>
                    <TableCell>{s.fingerprint_id ?? "—"}</TableCell>
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
