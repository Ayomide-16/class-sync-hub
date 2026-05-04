import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DAYS } from "@/lib/time";

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
  const { data, isLoading } = useQuery({
    queryKey: ["all-courses-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, course_code, course_name, lecturer:profiles!courses_lecturer_id_fkey(full_name), schedules(day_of_week, start_time, end_time, venue, device_id), course_enrollments(count)")
        .order("course_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">All courses</h1>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        {(data ?? []).map((c: any) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {c.course_code} <span className="font-normal text-muted-foreground">— {c.course_name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-muted-foreground">
              <div>Lecturer: {c.lecturer?.full_name ?? "Unassigned"}</div>
              <div>{c.course_enrollments?.[0]?.count ?? 0} students</div>
              {(c.schedules ?? []).map((s: any, i: number) => (
                <div key={i}>
                  {DAYS[s.day_of_week]} {String(s.start_time).slice(0, 5)}–
                  {String(s.end_time).slice(0, 5)} · {s.venue ?? "—"}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
