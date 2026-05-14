import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ADMIN_EMAIL = "abolarinwasa@gmail.com";
const ADMIN_SESSION_KEY = "aeirg_admin_pw";
const STUDENT_SESSION_KEY = "aeirg_student";

export const Route = createFileRoute("/aeirg/login")({
  head: () => ({ meta: [{ title: "AEIRG Login" }] }),
  component: AeirgLogin,
});

function AeirgLogin() {
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = identifier.trim();
    if (!id || !password) return;
    setBusy(true);
    try {
      // Admin path
      if (id.toLowerCase() === ADMIN_EMAIL) {
        const { data, error } = await supabase.rpc("aeirg_verify_password" as any, { _password: password } as any);
        if (error || !data) {
          toast.error("Invalid credentials");
          return;
        }
        sessionStorage.setItem(ADMIN_SESSION_KEY, password);
        nav({ to: "/aeirg/admin" });
        return;
      }
      // Student path
      const { data, error } = await supabase.rpc("aeirg_student_login" as any, {
        _matric: id,
        _password: password,
      } as any);
      if (error || !data || !(data as any).ok) {
        toast.error("Invalid credentials");
        return;
      }
      const payload = data as any;
      sessionStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify({
        matric_number: payload.matric_number,
        name: payload.name,
        must_change_password: !!payload.must_change_password,
      }));
      nav({ to: "/aeirg/student" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-primary/10 to-accent/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>AEIRG Login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Students sign in with their matric number. Admin signs in with email.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Email or Matric Number</Label>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                placeholder="2022186871ET or admin@email"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </Button>
            <Link to="/aeirg" className="block text-center text-xs text-muted-foreground hover:underline">
              ← Back to public register
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
