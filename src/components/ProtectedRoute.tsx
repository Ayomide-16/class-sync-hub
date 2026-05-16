import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: AppRole[];
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (allowedRoles && user.role && !allowedRoles.includes(user.role)) {
      // Send to their own dashboard.
      const map: Record<AppRole, string> = {
        student: "/student",
        lecturer: "/lecturer",
        course_rep: "/course-rep",
      };
      navigate({ to: map[user.role] });
    }
  }, [user, loading, allowedRoles, navigate]);

  if (loading) {
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
  if (!user) return null;
  if (allowedRoles && user.role && !allowedRoles.includes(user.role)) return null;
  return <>{children}</>;
}
