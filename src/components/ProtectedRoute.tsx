import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, AppRole } from "@/contexts/AuthContext";

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
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return null;
  if (allowedRoles && user.role && !allowedRoles.includes(user.role)) return null;
  return <>{children}</>;
}
