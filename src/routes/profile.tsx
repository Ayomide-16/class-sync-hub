import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/profile")({
  component: () => (
    <ProtectedRoute>
      <DashboardLayout>
        <Profile />
      </DashboardLayout>
    </ProtectedRoute>
  ),
});

function Profile() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Field label="Full name" value={user?.full_name ?? "—"} />
          <Field label="Matric number" value={user?.matric_number ?? "—"} mono />
          <Field label="Role">
            <Badge variant="secondary" className="capitalize">{user?.role?.replace("_", " ")}</Badge>
          </Field>
          <Field label="RFID card" value={user?.rfid_card_id ?? "Not enrolled yet"} mono />
          <Field label="Fingerprint ID" value={user?.fingerprint_id?.toString() ?? "Not enrolled yet"} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, children, mono }: { label: string; value?: string; children?: any; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      {children ?? <span className={mono ? "font-mono text-xs" : ""}>{value}</span>}
    </div>
  );
}
