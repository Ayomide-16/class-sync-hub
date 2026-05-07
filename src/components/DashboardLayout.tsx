import { ReactNode } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, GraduationCap, LayoutDashboard, BookOpen, Calendar, Users, User } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  student: [
    { to: "/student", label: "Dashboard", icon: LayoutDashboard },
    { to: "/student/courses", label: "Courses", icon: BookOpen },
    { to: "/profile", label: "Profile", icon: User },
  ],
  lecturer: [
    { to: "/lecturer", label: "Dashboard", icon: LayoutDashboard },
    { to: "/lecturer/courses", label: "My Courses", icon: BookOpen },
    { to: "/profile", label: "Profile", icon: User },
  ],
  course_rep: [
    { to: "/course-rep", label: "Dashboard", icon: LayoutDashboard },
    { to: "/course-rep/courses", label: "Courses", icon: BookOpen },
    { to: "/course-rep/timetable", label: "Timetable", icon: Calendar },
    { to: "/course-rep/students", label: "Students", icon: Users },
    { to: "/profile", label: "Profile", icon: User },
  ],
};

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const items = user?.role ? NAV_BY_ROLE[user.role] ?? [] : [];
  const currentPath = router.state.location.pathname;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)]">
        <div className="p-5 border-b border-sidebar-border flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12 text-white shadow-sm ring-1 ring-white/10">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight text-white">AttendClass</div>
            <div className="text-xs text-white/70">FUT Minna</div>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {items.map((it) => {
            const Icon = it.icon;
            const active = currentPath === it.to;

            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/85 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="text-xs text-sidebar-foreground/90">
            <div className="font-medium truncate text-white">{user?.full_name}</div>
            <div className="text-sidebar-foreground/70 truncate">{user?.matric_number}</div>
            <div className="text-sidebar-foreground/70 capitalize">
              {user?.role?.replace("_", " ")}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-white" />
            <span className="font-semibold text-white">AttendClass</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}