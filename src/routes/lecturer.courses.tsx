import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DAYS } from "@/lib/time";

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
  const { data, isLoading } = useQuery({
    queryKey: ["lecturer-courses-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, course_code, course_name, schedules(id, day_of_week, start_time, end_time, venue, device_id), course_enrollments(count)")
        .eq("lecturer_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Courses</h1>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        {(data ?? []).map((c: any) => (
          <Card key={c.id} className="hover:shadow-md transition">
            <CardHeader>
              <CardTitle className="text-base">
                {c.course_code}{" "}
                <span className="font-normal text-muted-foreground">— {c.course_name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div>{c.course_enrollments?.[0]?.count ?? 0} students enrolled</div>
              {(c.schedules ?? []).map((s: any) => (
                <div key={s.id}>
                  {DAYS[s.day_of_week]} {String(s.start_time).slice(0, 5)}–
                  {String(s.end_time).slice(0, 5)} · {s.venue ?? "—"}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No courses assigned to you yet.</p>
        )}
      </div>
    </div>
  );
}
