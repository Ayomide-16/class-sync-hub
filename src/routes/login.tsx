import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Sign in to AttendClass</h1>
          <p className="text-muted-foreground">Welcome back. Sign in to your account.</p>
        </div>

        {/* Main Form */}
        <form onSubmit={submit} className="space-y-6">
          {/* Email/Matric Input */}
          <div className="space-y-2">
            <Label htmlFor="id" className="text-sm font-medium">
              Username or Email
            </Label>
            <Input
              id="id"
              placeholder="Enter your login ID"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              className="h-12 rounded-lg border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Password Input with Forgot Link */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pw" className="text-sm font-medium">
                Password
              </Label>
              <a
                href="#"
                className="text-sm text-primary hover:underline font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("Password recovery not yet available");
                }}
              >
                Forgot?
              </a>
            </div>
            <Input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-12 rounded-lg border border-input bg-background px-4 py-3 text-base placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Sign In Button */}
          <Button
            type="submit"
            className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-semibold text-base rounded-lg"
            disabled={busy}
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Sign in
          </Button>
        </form>

        {/* Demo Credentials Section */}
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Quick demo login
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.label}
                type="button"
                onClick={() => fill(d.id, d.pw)}
                className="rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Additional Links */}
        <div className="space-y-4 text-center">
          <div className="pt-4 border-t border-border">
            <a href="/aeirg" className="text-sm text-primary hover:underline font-medium">
              AEIRG IT Attendance →
            </a>
            <p className="text-xs text-muted-foreground mt-2">Public attendance register (no login required)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
