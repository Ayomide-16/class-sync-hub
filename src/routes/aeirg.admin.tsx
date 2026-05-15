import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { aeirgAdmin } from "@/lib/aeirg-admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, FileSpreadsheet, Inbox, CalendarX, Settings as SettingsIcon, LogOut, Search, Trash2, Pencil, Edit, ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AeirgStudent, AeirgAttendance, AeirgCancelledDay,
  workingDaysBetween, presenceMap, manualMap, cancelledSet,
  attendanceStats, sortBySurname, watToday,
} from "@/lib/aeirg.ts";
import { RegisterTab } from "./aeirg.index";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";

const ADMIN_EMAIL = "abolarinwasa@gmail.com";
const SESSION_KEY = "aeirg_admin_pw";

export const Route = createFileRoute("/aeirg/admin")({
  head: () => ({ meta: [{ title: "AEIRG Admin" }] }),
  component: AeirgAdminPage,
});

function AeirgAdminPage() {
  const nav = useNavigate();
  const [pw, setPw] = useState<string | null>(
    typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null,
  );
  useEffect(() => {
    if (!pw) nav({ to: "/aeirg/login" });
  }, [pw, nav]);
  if (!pw) return null;
  return <AdminShell pw={pw} onLogout={() => {
    sessionStorage.removeItem(SESSION_KEY);
    setPw(null);
    nav({ to: "/aeirg/login" });
  }} />;
}

function AdminLogin({ onSuccess }: { onSuccess: (pw: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
      toast.error("Invalid admin email");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("aeirg_verify_password" as any, { _password: password } as any);
    setBusy(false);
    if (error || !data) {
      toast.error("Invalid password");
      return;
    }
    onSuccess(password);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-primary/10 to-accent/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>AEIRG Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground">Restricted access — admin credentials required.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
            </div>
            <div>
              <Label>Password</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Checking…" : "Sign In"}</Button>
            <Link to="/aeirg" className="block text-center text-xs text-muted-foreground hover:underline">
              ← Back to public register
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

type Section = "dashboard" | "students" | "register" | "packets" | "cancelled" | "flags" | "settings";

function AdminShell({ pw, onLogout }: { pw: string; onLogout: () => void }) {
  const [section, setSection] = useState<Section>("dashboard");
  const flagCount = useQuery({
    queryKey: ["aeirg", "flag-count"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("checkin_flags" as any)
        .select("id", { count: "exact", head: true })
        .eq("dismissed", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const items: { id: Section; label: string; icon: any; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "students", label: "Students", icon: Users },
    { id: "register", label: "Attendance Register", icon: FileSpreadsheet },
    { id: "packets", label: "Raw Packets", icon: Inbox },
    { id: "flags", label: "Flagged Check-ins", icon: ShieldAlert, badge: flagCount.data ?? 0 },
    { id: "cancelled", label: "Cancelled Days", icon: CalendarX },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];
  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="w-60 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="font-bold">AEIRG Admin</div>
          <div className="text-xs text-muted-foreground">{ADMIN_EMAIL}</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => setSection(it.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left ${section === it.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <it.icon className="h-4 w-4" /><span className="flex-1">{it.label}</span>
              {!!it.badge && it.badge > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{it.badge}</Badge>
              )}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t space-y-1">
          <Link to="/aeirg" className="block px-3 py-2 text-xs text-muted-foreground hover:underline">View public page →</Link>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" />Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <AdminSection section={section} pw={pw} />
      </main>
    </div>
  );
}

function useAdminData() {
  const students = useQuery({
    queryKey: ["aeirg", "students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aeirg_students" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as AeirgStudent[];
    },
  });
  const attendance = useQuery({
    queryKey: ["aeirg", "attendance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aeirg_attendance" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as AeirgAttendance[];
    },
  });
  const cancelled = useQuery({
    queryKey: ["aeirg", "cancelled"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aeirg_cancelled_days" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as AeirgCancelledDay[];
    },
  });
  const packets = useQuery({
    queryKey: ["aeirg", "packets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aeirg_raw_packets" as any).select("*").order("received_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const config = useQuery({
    queryKey: ["aeirg", "config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aeirg_admin_config" as any).select("*").eq("id", 1).single();
      if (error) throw error;
      return data as any;
    },
  });
  const flags = useQuery({
    queryKey: ["aeirg", "flags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("checkin_flags" as any)
        .select("*").eq("dismissed", false).order("flagged_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  return { students, attendance, cancelled, packets, config, flags };
}

function AdminSection({ section, pw }: { section: Section; pw: string }) {
  const data = useAdminData();
  const qc = useQueryClient();
  const callRaw = useServerFn(aeirgAdmin);
  const call = async (op: string, args: Record<string, any> = {}) => {
    try {
      const r = await callRaw({ data: { password: pw, op, args } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["aeirg", "students"] }),
        qc.invalidateQueries({ queryKey: ["aeirg", "attendance"] }),
        qc.invalidateQueries({ queryKey: ["aeirg", "cancelled"] }),
        qc.invalidateQueries({ queryKey: ["aeirg", "packets"] }),
        qc.invalidateQueries({ queryKey: ["aeirg", "config"] }),
        qc.invalidateQueries({ queryKey: ["aeirg", "flags"] }),
        qc.invalidateQueries({ queryKey: ["aeirg", "flag-count"] }),
      ]);
      return r;
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
      throw e;
    }
  };

  if (data.students.isLoading) return <p className="text-muted-foreground">Loading…</p>;

  switch (section) {
    case "dashboard": return <Dashboard data={data} />;
    case "students": return <StudentsSection data={data} call={call} />;
    case "register": return <RegisterAdmin data={data} call={call} />;
    case "packets": return <PacketsSection data={data} call={call} />;
    case "cancelled": return <CancelledSection data={data} call={call} />;
    case "flags": return <FlagsSection data={data} call={call} />;
    case "settings": return <SettingsSection data={data} call={call} />;
  }
}

function Dashboard({ data }: { data: ReturnType<typeof useAdminData> }) {
  const today = watToday();
  const students = data.students.data ?? [];
  const attendance = data.attendance.data ?? [];
  const cancelled = data.cancelled.data ?? [];
  const config = data.config.data;

  const startDate = attendance.length === 0 ? today : attendance.reduce((m, a) => a.attendance_date < m ? a.attendance_date : m, attendance[0].attendance_date);
  const days = workingDaysBetween(startDate, today);
  const cset = cancelledSet(cancelled);
  const presence = presenceMap(attendance);
  const totalDays = days.filter((d) => !cset.has(d)).length;

  const avgPct = students.length === 0 ? 0 : Math.round(
    (students.reduce((acc, s) => acc + attendanceStats(s.matric_number, s.added_at, days, presence, cset).pct, 0) / students.length) * 10
  ) / 10;

  const daysRemaining = config?.it_period_end_date
    ? Math.max(0, Math.ceil((new Date(config.it_period_end_date).getTime() - new Date(today).getTime()) / 86400000))
    : null;

  // Weekly bar chart: group by ISO week.
  const weekly = useMemo(() => {
    const m = new Map<string, { week: string; presentCells: number; totalCells: number }>();
    for (const d of days) {
      if (cset.has(d)) continue;
      const dt = new Date(d + "T00:00:00Z");
      const onejan = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
      const week = `${dt.getUTCFullYear()}-W${String(Math.ceil((((dt.getTime() - onejan.getTime()) / 86400000) + onejan.getUTCDay() + 1) / 7)).padStart(2, "0")}`;
      let entry = m.get(week);
      if (!entry) { entry = { week, presentCells: 0, totalCells: 0 }; m.set(week, entry); }
      for (const s of students) {
        if (d < s.added_at.slice(0, 10)) continue;
        entry.totalCells++;
        if (presence.get(s.matric_number)?.has(d)) entry.presentCells++;
      }
    }
    return Array.from(m.values()).map((w) => ({ week: w.week.slice(5), pct: w.totalCells === 0 ? 0 : Math.round((w.presentCells / w.totalCells) * 1000) / 10 }));
  }, [days, students, presence, cset]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Students" value={students.length} />
        <StatCard label="Total Days Logged" value={totalDays} />
        <StatCard label="Avg Attendance" value={`${avgPct}%`} />
        <StatCard label="Days Remaining" value={daysRemaining ?? "—"} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Weekly attendance rate</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly}>
              <XAxis dataKey="week" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="pct" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </CardContent></Card>
  );
}

function StudentsSection({ data, call }: { data: ReturnType<typeof useAdminData>; call: (op: string, args?: any) => Promise<any> }) {
  const today = watToday();
  const students = sortBySurname(data.students.data ?? []);
  const attendance = data.attendance.data ?? [];
  const cancelled = data.cancelled.data ?? [];
  const startDate = attendance.length === 0 ? today : attendance.reduce((m, a) => a.attendance_date < m ? a.attendance_date : m, attendance[0].attendance_date);
  const days = workingDaysBetween(startDate, today);
  const cset = cancelledSet(cancelled);
  const presence = presenceMap(attendance);

  const [search, setSearch] = useState("");
  const filtered = students.filter((s) =>
    `${s.name} ${s.matric_number}`.toLowerCase().includes(search.toLowerCase()),
  );

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [matric, setMatric] = useState("");
  const [editing, setEditing] = useState<AeirgStudent | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Students</h2>
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogTrigger asChild><Button>Add Student</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add student</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Matric Number</Label><Input value={matric} onChange={(e) => setMatric(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button onClick={async () => {
                if (!name.trim() || !matric.trim()) return;
                await call("addStudent", { name: name.trim(), matric_number: matric.trim() });
                toast.success("Student added");
                setName(""); setMatric(""); setAdding(false);
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Matric</th>
              <th className="text-right px-3 py-2">Present</th>
              <th className="text-right px-3 py-2">Absent</th>
              <th className="text-right px-3 py-2">%</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const stats = attendanceStats(s.matric_number, s.added_at, days, presence, cset);
              return (
                <tr key={s.id} className="border-b">
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.matric_number}</td>
                  <td className="px-3 py-2 text-right">{stats.present}</td>
                  <td className="px-3 py-2 text-right">{stats.absent}</td>
                  <td className="px-3 py-2 text-right font-medium">{stats.pct}%</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setEditName(s.name); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {s.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the student and all their attendance records.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={async () => {
                            await call("deleteStudent", { id: s.id });
                            toast.success("Deleted");
                          }}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No students.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit student name</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Matric (read-only)</Label><Input value={editing?.matric_number ?? ""} disabled /></div>
            <div><Label>Full Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              if (!editing || !editName.trim()) return;
              await call("updateStudentName", { id: editing.id, name: editName.trim() });
              toast.success("Updated");
              setEditing(null);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegisterAdmin({ data, call }: { data: ReturnType<typeof useAdminData>; call: (op: string, args?: any) => Promise<any> }) {
  const today = watToday();
  const students = sortBySurname(data.students.data ?? []);
  const attendance = data.attendance.data ?? [];
  const cancelled = data.cancelled.data ?? [];
  const startDate = attendance.length === 0 ? today : attendance.reduce((m, a) => a.attendance_date < m ? a.attendance_date : m, attendance[0].attendance_date);
  const manual = useMemo(() => manualMap(attendance), [attendance]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Attendance Register (editable)</h2>
      <p className="text-sm text-muted-foreground">Click any cell to toggle. Blue dot = manually overridden.</p>
      <RegisterTab
        students={students}
        attendance={attendance}
        cancelled={cancelled}
        startDate={startDate}
        today={today}
        editable
        manual={manual}
        onToggle={async (m: string, d: string, currentlyPresent: boolean) => {
          await call("toggleAttendance", { matric_number: m, attendance_date: d, currentlyPresent });
        }}
      />
    </div>
  );
}

function PacketsSection({ data, call }: { data: ReturnType<typeof useAdminData>; call: (op: string, args?: any) => Promise<any> }) {
  const packets = data.packets.data ?? [];
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reassign, setReassign] = useState<{ id: string; date: string } | null>(null);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Raw Packets</h2>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2">Assigned Date</th>
              <th className="text-left px-3 py-2">Received At</th>
              <th className="text-right px-3 py-2"># Students</th>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {packets.map((p) => {
              const matrics: string[] = p.matric_numbers_json ?? [];
              return (
                <Fragment key={p.id}>
                  <tr className="border-b cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                    <td className="px-3 py-2 font-medium">{p.assigned_date}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(p.received_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{matrics.length}</td>
                    <td className="px-3 py-2">{p.packet_source}</td>
                    <td className="px-3 py-2 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => setReassign({ id: p.id, date: p.assigned_date })}>
                        <Edit className="h-3 w-3 mr-1" />Reassign
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost"><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this packet?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Removes the packet and all auto-generated attendance records from it.
                              Manual records are preserved.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => {
                              await call("deletePacket", { packet_id: p.id });
                              toast.success("Deleted");
                            }}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                  {expanded === p.id && (
                    <tr><td colSpan={5} className="bg-muted/30 px-3 py-2 text-xs">
                      <div className="font-semibold mb-1">Matric numbers in this packet:</div>
                      <div className="flex flex-wrap gap-1">
                        {matrics.map((m) => <span key={m} className="bg-card border rounded px-2 py-0.5">{m}</span>)}
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
            {packets.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No packets received yet.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent></Card>

      <AlertDialog open={!!reassign} onOpenChange={(o) => !o && setReassign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reassign packet date</AlertDialogTitle>
            <AlertDialogDescription>
              Auto-generated attendance records under the old date will be deleted and recreated under the new date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input type="date" value={reassign?.date ?? ""} onChange={(e) => setReassign((r) => r ? { ...r, date: e.target.value } : r)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!reassign) return;
              await call("reassignPacket", { packet_id: reassign.id, new_date: reassign.date });
              toast.success("Reassigned");
              setReassign(null);
            }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CancelledSection({ data, call }: { data: ReturnType<typeof useAdminData>; call: (op: string, args?: any) => Promise<any> }) {
  const cancelled = (data.cancelled.data ?? []).slice().sort((a, b) => a.cancelled_date.localeCompare(b.cancelled_date));
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Cancelled Days</h2>
      <Card><CardHeader><CardTitle className="text-base">Cancel a day</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="flex-1 min-w-[200px]"><Label>Reason (optional)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button onClick={async () => {
            if (!date) return;
            await call("cancelDay", { cancelled_date: date, reason: reason || null });
            toast.success("Day cancelled");
            setDate(""); setReason("");
          }}>Cancel Day</Button>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Reason</th><th className="text-right px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {cancelled.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="px-3 py-2">{c.cancelled_date}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.reason || "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={async () => {
                    await call("uncancelDay", { id: c.id });
                    toast.success("Removed");
                  }}>Reinstate</Button>
                </td>
              </tr>
            ))}
            {cancelled.length === 0 && <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">No cancelled days.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

function SettingsSection({ data, call }: { data: ReturnType<typeof useAdminData>; call: (op: string, args?: any) => Promise<any> }) {
  const config = data.config.data;
  const [endDate, setEndDate] = useState<string>(config?.it_period_end_date ?? "");
  useEffect(() => { setEndDate(config?.it_period_end_date ?? ""); }, [config?.it_period_end_date]);
  const [cur, setCur] = useState(""); const [n1, setN1] = useState(""); const [n2, setN2] = useState("");

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card><CardHeader><CardTitle className="text-base">IT Period End Date</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Button onClick={async () => {
            await call("updateConfig", { it_period_end_date: endDate || null });
            toast.success("Saved");
          }}>Save</Button>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Current password</Label><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div><Label>New password</Label><Input type="password" value={n1} onChange={(e) => setN1(e.target.value)} /></div>
          <div><Label>Confirm new password</Label><Input type="password" value={n2} onChange={(e) => setN2(e.target.value)} /></div>
          <Button onClick={async () => {
            if (!cur || !n1) return;
            if (n1 !== n2) { toast.error("New passwords don't match"); return; }
            await call("changePassword", { current_password: cur, new_password: n1 });
            toast.success("Password updated. Please sign in again.");
            sessionStorage.removeItem(SESSION_KEY);
            window.location.reload();
          }}>Update Password</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FlagsSection({ data, call }: { data: ReturnType<typeof useAdminData>; call: (op: string, args?: any) => Promise<any> }) {
  const flags = data.flags.data ?? [];
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Flagged Check-ins</h2>
      <p className="text-sm text-muted-foreground">
        Same browser used by different students. Review each one and dismiss or revoke the attendance.
      </p>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2">Date / Time</th>
              <th className="text-left px-3 py-2">Browser</th>
              <th className="text-left px-3 py-2">Previous Student</th>
              <th className="text-left px-3 py-2">Attempted Student</th>
              <th className="text-left px-3 py-2">Device</th>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f: any) => (
              <tr key={f.id} className="border-b">
                <td className="px-3 py-2 font-mono text-xs">{new Date(f.flagged_at).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-xs">{String(f.browser_token).slice(0, 8)}…</td>
                <td className="px-3 py-2 font-mono text-xs">{f.first_student_id}</td>
                <td className="px-3 py-2 font-mono text-xs">{f.attempted_student_id}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{f.ble_device_name ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{f.source}</td>
                <td className="px-3 py-2 text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={async () => {
                    await call("dismissFlag", { id: f.id });
                    toast.success("Dismissed");
                  }}>Dismiss</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">Revoke Attendance</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke attendance?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Removes the attendance record for {f.attempted_student_id} on{" "}
                          {f.flagged_date ?? new Date(f.flagged_at).toISOString().slice(0, 10)} and dismisses this flag.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                          await call("revokeFlaggedAttendance", { id: f.id });
                          toast.success("Attendance revoked");
                        }}>Revoke</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </td>
              </tr>
            ))}
            {flags.length === 0 && (
              <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No flagged check-ins.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}

// Tiny inline Fragment helper to avoid extra imports.
function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
