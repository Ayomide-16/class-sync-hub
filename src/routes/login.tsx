import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2, BookOpen, Shield, Users } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-[412px] rounded-2xl border border-border/70 shadow-[0_24px_60px_rgba(91,45,120,0.12)]">
        <CardHeader className="space-y-3 pt-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-xl">AttendClass</CardTitle>
            <p className="text-sm text-muted-foreground">FUT Minna</p>
          </div>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="id">Email or Matric Number</Label>
              <Input
                id="id"
                placeholder="Enter your login ID"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign In
            </Button>
          </form>

          <div className="mt-6 border-t pt-5">
            <p className="text-sm text-muted-foreground mb-3">Quick demo login</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d, index) => {
                const icon = index === 0 ? Users : index === 1 ? Shield : BookOpen;
                const Icon = icon;

                return (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => fill(d.id, d.pw)}
                    className="rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      {d.label}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-muted-foreground">
                      {d.id}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
