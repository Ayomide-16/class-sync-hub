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
    <div className="min-h-screen bg-background text-foreground md:pl-[240px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-border bg-card text-foreground md:flex">
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-[#EFF6FF] text-primary">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[15px] font-semibold leading-tight text-foreground">AttendClass</div>
            <div className="text-[13px] text-[#525252]">FUT Minna</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map((it) => {
            const Icon = it.icon;
            const active = currentPath === it.to;

            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex h-9 items-center gap-2 rounded-md border-l-2 px-3 text-[13px] transition ${
                  active
                    ? "border-primary bg-[#EFF6FF] text-primary"
                    : "border-transparent text-[#525252] hover:bg-[#F4F4F5] hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-border px-4 py-4">
          <div className="text-[13px]">
            <div className="truncate font-medium text-foreground">{user?.full_name}</div>
            <div className="truncate text-[#A1A1AA]">{user?.matric_number}</div>
            <div className="capitalize text-[#A1A1AA]">
              {user?.role?.replace("_", " ")}
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-10">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary md:hidden" />
            <span className="text-[15px] font-semibold text-foreground">AttendClass</span>
          </div>
          <Button
            variant="ghost"
            className="md:hidden"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <main className="flex-1 px-4 py-8 md:px-10 md:py-8">{children}</main>
      </div>
    </div>
  );
}