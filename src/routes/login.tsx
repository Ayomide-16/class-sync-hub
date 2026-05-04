import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const HOME: Record<AppRole, string> = {
  student: "/student",
  lecturer: "/lecturer",
  course_rep: "/course-rep",
};

const DEMO = [
  { label: "Student", id: "2022/1/86884ET", pw: "aisuedion" },
  { label: "Lecturer", id: "2022/1/86871ET", pw: "abolarinwa" },
  { label: "Course Rep", id: "2022/1/86861ET", pw: "zang" },
];

function LoginPage() {
  const { user, signIn, loading } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user?.role) navigate({ to: HOME[user.role] });
  }, [user, loading, navigate]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!identifier || !password) return;
    setBusy(true);
    const { error } = await signIn(identifier, password);
    setBusy(false);
    if (error) toast.error("Login failed", { description: error });
  }

  function fill(id: string, pw: string) {
    setIdentifier(id);
    setPassword(pw);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8" />
          <div>
            <div className="text-xl font-semibold">AttendClass</div>
            <div className="text-sm opacity-80">Federal University of Technology, Minna</div>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Biometric attendance, <br /> made effortless.
          </h1>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Sign in to view your live class roster, manage timetables, or check your own
            attendance — all powered by your classroom's AttendESP device.
          </p>
        </div>
        <div className="text-xs opacity-70">© {new Date().getFullYear()} AttendClass</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 lg:hidden mb-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="font-semibold">AttendClass</span>
            </div>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <p className="text-sm text-muted-foreground">
              Use your matric number and surname (lowercase).
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="id">Matric number</Label>
                <Input
                  id="id"
                  placeholder="e.g. 2022/1/86871ET"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Password (your surname)</Label>
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sign in
              </Button>
            </form>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground mb-2">Quick demo logins:</p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO.map((d) => (
                  <Button
                    key={d.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fill(d.id, d.pw)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
