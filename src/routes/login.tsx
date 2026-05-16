import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, HelpCircle } from "lucide-react";
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
  { label: "Lecturer", id: "foloruso@attendclass.com", pw: "lecturer" },
  { label: "Course Rep", id: "courserep@attendclass.com", pw: "courserep" },
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
    <div className="min-h-screen bg-background px-4 py-12 md:py-16">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-[400px] items-center">
        <Card className="w-full rounded-lg border border-border shadow-[var(--shadow-md)]">
          <CardContent className="space-y-6 p-10">
            <div className="space-y-2 text-center">
              <h1 className="text-xl font-bold tracking-tight">AttendClass</h1>
              <p className="text-sm text-[#525252]">Sign in to your dashboard or use a demo account.</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="id" className="text-xs font-medium text-[#525252]">Username or Email</Label>
                <Input
                  id="id"
                  placeholder="Enter your login ID"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pw" className="text-xs font-medium text-[#525252]">Password</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => toast.info("Password recovery not yet available")}
                  >
                    Forgot?
                  </button>
                </div>
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <span className="mr-2 h-2 w-2 rounded-full bg-current animate-pulse" />}
                Sign in
              </Button>
            </form>

            <div className="space-y-3 border-t border-border pt-6">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.05em] text-[#525252]">
                <HelpCircle className="h-4 w-4" />
                Quick demo login
              </div>
              <div className="space-y-2">
                {DEMO.map((d) => (
                  <Button
                    key={d.label}
                    type="button"
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => fill(d.id, d.pw)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-6 text-center">
              <a href="/aeirg" className="text-sm font-medium text-primary hover:underline">
                AEIRG IT Attendance →
              </a>
              <p className="mt-2 text-xs text-[#A1A1AA]">Public attendance register (no login required)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
