import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  component: Index,
});

const HOME: Record<AppRole, string> = {
  student: "/student",
  lecturer: "/lecturer",
  course_rep: "/course-rep",
};

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (user.role) navigate({ to: HOME[user.role] });
  }, [user, loading, navigate]);
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <Card className="mx-auto flex min-h-[240px] max-w-md items-center justify-center">
        <CardHeader className="w-full">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="w-full space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}
