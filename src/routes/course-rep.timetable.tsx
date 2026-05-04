import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DAYS } from "@/lib/time";

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
  const { data, isLoading } = useQuery({
    queryKey: ["timetable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("id, day_of_week, start_time, end_time, venue, device_id, course:courses(course_code, course_name)")
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  const byDay = DAYS.map((d, i) => ({
    day: d,
    items: (data ?? []).filter((s: any) => s.day_of_week === i),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Weekly timetable</h1>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {byDay.map((d) => (
          <Card key={d.day}>
            <CardHeader><CardTitle className="text-base">{d.day}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {d.items.length === 0 && (
                <p className="text-xs text-muted-foreground">No classes</p>
              )}
              {d.items.map((s: any) => (
                <div key={s.id} className="border rounded-md p-2 text-xs">
                  <div className="font-semibold">{s.course?.course_code}</div>
                  <div className="text-muted-foreground">
                    {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)}
                  </div>
                  <div className="text-muted-foreground">{s.venue ?? "—"} · {s.device_id ?? "—"}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
