import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Download, LogOut, Settings as SettingsIcon, LayoutDashboard, ScanLine } from "lucide-react";
import {
  BleCheckinFlow,
  getBrowserToken,
  getLastCheckinStudent,
  setLastCheckinStudent,
  type BleCheckinSuccess,
} from "@/components/BleCheckinFlow";
import {
  AeirgAttendance,
  AeirgCancelledDay,
  AeirgStudent,
  workingDaysBetween,
  presenceMap,
  cancelledSet,
  attendanceStats,
  cellStatus,
  watToday,
  dayName,
  downloadCsv,
} from "@/lib/aeirg";

const STUDENT_SESSION_KEY = "aeirg_student";

type StudentSession = {
  matric_number: string;
  name: string;
  must_change_password: boolean;
};

export const Route = createFileRoute("/aeirg/student")({
  head: () => ({ meta: [{ title: "AEIRG Student" }] }),
  component: AeirgStudentPage,
});

function readSession(): StudentSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STUDENT_SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StudentSession; } catch { return null; }
}

function AeirgStudentPage() {
  const nav = useNavigate();
  const [session, setSession] = useState<StudentSession | null>(() => readSession());

  useEffect(() => {
    if (!session) nav({ to: "/aeirg/login" });
  }, [session, nav]);

  if (!session) return null;

  function logout() {
    sessionStorage.removeItem(STUDENT_SESSION_KEY);
    nav({ to: "/aeirg/login" });
  }

  function updateSession(patch: Partial<StudentSession>) {
    const next = { ...session!, ...patch };
    setSession(next);
    sessionStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(next));
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{session.name}</h1>
            <p className="text-xs text-muted-foreground">{session.matric_number}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />Logout
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Dashboard session={session} />
      </main>

      {session.must_change_password && (
        <ForcePasswordModal
          matric={session.matric_number}
          onDone={() => updateSession({ must_change_password: false })}
        />
      )}
    </div>
  );
}

function Dashboard({ session }: { session: StudentSession }) {
  const today = watToday();

  const studentQ = useQuery({
    queryKey: ["aeirg", "me", session.matric_number],
    queryFn: async () => {
      const { data, error } = await supabase.from("aeirg_students" as any)
        .select("*").eq("matric_number", session.matric_number).single();
      if (error) throw error;
      return data as unknown as AeirgStudent;
    },
  });
  const attendanceQ = useQuery({
    queryKey: ["aeirg", "me-attendance", session.matric_number],
    queryFn: async () => {
      const { data, error } = await supabase.from("aeirg_attendance" as any)
        .select("*").eq("matric_number", session.matric_number);
      if (error) throw error;
      return (data ?? []) as unknown as AeirgAttendance[];
    },
  });
  const cancelledQ = useQuery({
    queryKey: ["aeirg", "cancelled"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aeirg_cancelled_days" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as AeirgCancelledDay[];
    },
  });
  const allAttendanceQ = useQuery({
    queryKey: ["aeirg", "all-attendance-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aeirg_attendance" as any)
        .select("attendance_date").order("attendance_date", { ascending: true }).limit(1);
      if (error) throw error;
      return (data ?? []) as unknown as { attendance_date: string }[];
    },
  });

  const student = studentQ.data;
  const attendance = attendanceQ.data ?? [];
  const cancelled = cancelledQ.data ?? [];

  const startDate = useMemo(() => {
    const minGlobal = allAttendanceQ.data?.[0]?.attendance_date;
    const minOwn = attendance[0]?.attendance_date;
    const addedAt = student?.added_at?.slice(0, 10);
    const candidates = [minGlobal, minOwn, addedAt].filter(Boolean) as string[];
    if (candidates.length === 0) return today;
    return candidates.reduce((a, b) => (a < b ? a : b));
  }, [allAttendanceQ.data, attendance, student, today]);

  const presence = useMemo(() => presenceMap(attendance), [attendance]);
  const cset = useMemo(() => cancelledSet(cancelled), [cancelled]);
  const days = useMemo(() => workingDaysBetween(startDate, today), [startDate, today]);

  const stats = student
    ? attendanceStats(student.matric_number, student.added_at, days, presence, cset)
    : { present: 0, absent: 0, pct: 0 };

  function exportCsv() {
    if (!student) return;
    const rows: (string | number)[][] = [["Date", "Day", "Status"]];
    for (const d of days) {
      if (d < student.added_at.slice(0, 10)) continue;
      const status = cset.has(d) ? "Holiday" : presence.get(student.matric_number)?.has(d) ? "Present" : "Absent";
      rows.push([d, dayName(d), status]);
    }
    downloadCsv(rows, `AEIRG_${student.matric_number}_${today}.csv`);
  }

  if (studentQ.isLoading || attendanceQ.isLoading || cancelledQ.isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (!student) {
    return <p className="text-rose-500">Student record not found.</p>;
  }

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview"><LayoutDashboard className="h-4 w-4 mr-1" />Overview</TabsTrigger>
        <TabsTrigger value="settings"><SettingsIcon className="h-4 w-4 mr-1" />Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <CheckInCard session={session} />
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Days Present</div>
            <div className="text-2xl font-bold text-emerald-600">{stats.present}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Days Absent</div>
            <div className="text-2xl font-bold text-rose-500">{stats.absent}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Attendance %</div>
            <div className="text-2xl font-bold">{stats.pct}%</div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Attendance pattern</CardTitle>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" />CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {days.map((d) => {
                if (d < student.added_at.slice(0, 10)) return null;
                const status = cellStatus(student.matric_number, d, presence, cset);
                const cls =
                  status === "holiday" ? "bg-muted text-muted-foreground" :
                  status === "present" ? "bg-emerald-500/80 text-white" :
                  "bg-rose-500/70 text-white";
                return (
                  <div
                    key={d}
                    title={`${d} (${dayName(d)}) — ${status}`}
                    className={`h-6 w-6 rounded-sm grid place-items-center text-[10px] ${cls}`}
                  >
                    {d.slice(8)}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
              <span><span className="inline-block h-3 w-3 rounded-sm bg-emerald-500/80 mr-1 align-middle" />Present</span>
              <span><span className="inline-block h-3 w-3 rounded-sm bg-rose-500/70 mr-1 align-middle" />Absent</span>
              <span><span className="inline-block h-3 w-3 rounded-sm bg-muted mr-1 align-middle" />Holiday</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Day-by-day record</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Day</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {days.filter((d) => d >= student.added_at.slice(0, 10)).map((d) => {
                    const status = cellStatus(student.matric_number, d, presence, cset);
                    const label = status === "holiday" ? "Holiday" : status === "present" ? "Present" : "Absent";
                    const cls = status === "holiday" ? "text-muted-foreground" :
                      status === "present" ? "text-emerald-600" : "text-rose-500";
                    return (
                      <tr key={d} className="border-b">
                        <td className="px-3 py-2">{d}</td>
                        <td className="px-3 py-2 text-muted-foreground">{dayName(d)}</td>
                        <td className={`px-3 py-2 font-medium ${cls}`}>{label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="settings">
        <ChangePasswordCard matric={student.matric_number} />
      </TabsContent>
    </Tabs>
  );
}

function ChangePasswordCard({ matric }: { matric: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (next !== confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("aeirg_student_change_password" as any, {
      _matric: matric, _current: current, _new: next,
    } as any);
    setBusy(false);
    if (error || !data) { toast.error("Current password incorrect"); return; }
    toast.success("Password updated");
    setCurrent(""); setNext(""); setConfirm("");
  }

  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Current Password</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          <div><Label>New Password</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
          <div><Label>Confirm New Password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Update Password"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ForcePasswordModal({ matric, onDone }: { matric: string; onDone: () => void }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (next !== confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("aeirg_student_force_set_password" as any, {
      _matric: matric, _new: next,
    } as any);
    setBusy(false);
    if (error || !data) { toast.error("Could not set password"); return; }
    toast.success("Password set");
    onDone();
  }

  return (
    <Dialog open onOpenChange={() => { /* forced */ }}>
      <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Set a new password</DialogTitle>
          <p className="text-sm text-muted-foreground">
            You're signed in with the default password. Choose a new one to continue.
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>New Password</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
          <div><Label>Confirm Password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save Password"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckInCard({ session }: { session: StudentSession }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function onSuccess(info: BleCheckinSuccess) {
    setBusy(true);
    const last = getLastCheckinStudent();
    const previous = last && last !== session.matric_number ? last : null;
    try {
      const { data, error } = await supabase.rpc("aeirg_record_ble_attendance" as any, {
        _matric: session.matric_number,
        _ble_device: info.deviceName,
        _browser_token: getBrowserToken(),
        _previous_student: previous,
        _source: "aeirg",
      } as any);
      if (error) throw error;
      const res = (data ?? {}) as { ok?: boolean; already_recorded?: boolean; error?: string };
      if (!res.ok) throw new Error(res.error || "Failed to record attendance");
      setLastCheckinStudent(session.matric_number);
      if (res.already_recorded) {
        toast.info("Your attendance for today has already been recorded.");
      } else {
        toast.success("Attendance marked for today.");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["aeirg", "me-attendance", session.matric_number] }),
        qc.invalidateQueries({ queryKey: ["aeirg", "all-attendance-min"] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to record attendance");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="h-4 w-4" /> Mark Attendance
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Scan the QR on the AEIRG attendance device, then approve the Bluetooth pairing prompt.
        </p>
      </CardHeader>
      <CardContent>
        <BleCheckinFlow
          studentId={session.matric_number}
          onSuccess={onSuccess}
          startLabel={busy ? "Saving…" : "Mark Attendance"}
          helperText="Tap to scan the QR code on the AEIRG device. Your phone will pair via Bluetooth to confirm you're physically present."
        />
      </CardContent>
    </Card>
  );
}

