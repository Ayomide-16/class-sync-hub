import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, Calendar as CalIcon, Users, FileSpreadsheet } from "lucide-react";
import {
  AeirgStudent,
  AeirgAttendance,
  AeirgCancelledDay,
  workingDaysBetween,
  presenceMap,
  cancelledSet,
  cellStatus,
  attendanceStats,
  sortBySurname,
  watToday,
  dayName,
  downloadCsv,
  downloadRegisterXlsx,
} from "@/lib/aeirg";

export const Route = createFileRoute("/aeirg/")({
  head: () => ({
    meta: [
      { title: "AEIRG IT Attendance" },
      { name: "description", content: "AEIRG 6-month IT attendance register." },
    ],
  }),
  component: AeirgPublic,
});

function useAeirgData() {
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
  return { students, attendance, cancelled };
}

function AeirgPublic() {
  const { students, attendance, cancelled } = useAeirgData();
  const today = watToday();

  const loading = students.isLoading || attendance.isLoading || cancelled.isLoading;
  const hasData = (attendance.data?.length ?? 0) > 0;

  const startDate = useMemo(() => {
    const att = attendance.data ?? [];
    if (att.length === 0) return today;
    return att.reduce((min, a) => (a.attendance_date < min ? a.attendance_date : min), att[0].attendance_date);
  }, [attendance.data, today]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">AEIRG IT Attendance</h1>
          <p className="text-sm text-[#525252]">{new Date(today + "T12:00:00Z").toDateString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="secondary">AttendClass Home</Button>
          </Link>
          <Link to="/aeirg/login">
            <Button variant="outline">Login</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-10">
        {loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-[320px] w-full" />
            </CardContent>
          </Card>
        ) : !hasData ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#F4F4F5] text-[#A1A1AA]">∅</div>
              <div>
                <p className="text-sm text-[#525252]">No attendance recorded yet.</p>
                <p className="mt-1 text-sm text-[#A1A1AA]">Once the first synced packet arrives, the register will appear here automatically.</p>
              </div>
              <Link to="/aeirg/login">
                <Button>Login</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="register" className="space-y-4">
            <TabsList className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0">
              <TabsTrigger value="register" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">
                <FileSpreadsheet className="mr-1 h-4 w-4" />Student Register
              </TabsTrigger>
              <TabsTrigger value="daily" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">
                <CalIcon className="mr-1 h-4 w-4" />Daily View
              </TabsTrigger>
              <TabsTrigger value="student" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary">
                <Users className="mr-1 h-4 w-4" />Student Detail
              </TabsTrigger>
            </TabsList>
            <TabsContent value="register" className="pt-4">
              <RegisterTab
                students={sortBySurname(students.data ?? [])}
                attendance={attendance.data ?? []}
                cancelled={cancelled.data ?? []}
                startDate={startDate}
                today={today}
              />
            </TabsContent>
            <TabsContent value="daily" className="pt-4">
              <DailyTab
                students={sortBySurname(students.data ?? [])}
                attendance={attendance.data ?? []}
                cancelled={cancelled.data ?? []}
              />
            </TabsContent>
            <TabsContent value="student" className="pt-4">
              <StudentDetailTab
                students={sortBySurname(students.data ?? [])}
                attendance={attendance.data ?? []}
                cancelled={cancelled.data ?? []}
                startDate={startDate}
                today={today}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

export function RegisterTab({
  students,
  attendance,
  cancelled,
  startDate,
  today,
  editable,
  onToggle,
  manual,
}: {
  students: AeirgStudent[];
  attendance: AeirgAttendance[];
  cancelled: AeirgCancelledDay[];
  startDate: string;
  today: string;
  editable?: boolean;
  onToggle?: (matric: string, date: string, currentlyPresent: boolean) => void;
  manual?: Map<string, Map<string, boolean>>;
}) {
  const [from, setFrom] = useState(startDate);
  const [to, setTo] = useState(today);
  useEffect(() => { setFrom(startDate); setTo(today); }, [startDate, today]);

  const presence = useMemo(() => presenceMap(attendance), [attendance]);
  const cset = useMemo(() => cancelledSet(cancelled), [cancelled]);
  const allDays = useMemo(() => workingDaysBetween(startDate, today), [startDate, today]);
  const days = useMemo(() => allDays.filter((d) => d >= from && d <= to), [allDays, from, to]);

  function exportCsv() {
    const rows: (string | number)[][] = [];
    const header: (string | number)[] = ["S/N", "Student Name", "Matric Number"];
    for (const d of days) header.push(cset.has(d) ? `${d} (HOLIDAY)` : d);
    header.push("Days Present", "Days Absent", "Attendance %");
    rows.push(header);
    students.forEach((s, i) => {
      const r: (string | number)[] = [i + 1, s.name, s.matric_number];
      for (const d of days) {
        if (cset.has(d)) r.push("—");
        else r.push(presence.get(s.matric_number)?.has(d) ? "✓" : "✗");
      }
      const stats = attendanceStats(s.matric_number, s.added_at, allDays, presence, cset);
      r.push(stats.present, stats.absent, `${stats.pct}%`);
      rows.push(r);
    });
    downloadCsv(rows, `AEIRG_Attendance_Register_${today}.csv`);
  }

  function exportXlsx() {
    downloadRegisterXlsx({
      students,
      workingDays: days,
      cancelled: cset,
      presence,
      manual,
      filename: `AEIRG_Attendance_Register_${today}.xlsx`,
      includeManualFlag: !!editable,
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#525252]">From</label>
              <Input type="date" value={from} min={startDate} max={to} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#525252]">To</label>
              <Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="mr-1 h-4 w-4" />CSV</Button>
            <Button onClick={exportXlsx}><Download className="mr-1 h-4 w-4" />XLSX</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative max-h-[70vh] overflow-auto border-t border-border">
          <table className="border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-[#F4F4F5]">
              <tr>
                <th className="sticky left-0 z-30 w-12 border-r border-border bg-[#F4F4F5] px-4 py-3 text-left">S/N</th>
                <th className="sticky left-12 z-30 min-w-[200px] border-r border-border bg-[#F4F4F5] px-4 py-3 text-left">Student</th>
                {days.map((d) => (
                  <th key={d} className={`border-r border-border px-4 py-3 whitespace-nowrap text-center text-xs ${cset.has(d) ? "text-[#D97706]" : "text-[#525252]"}`}>
                    {cset.has(d) ? "—" : d.slice(5)}
                    <div className="text-[10px] font-normal text-[#A1A1AA]">{cset.has(d) ? "Holiday" : dayName(d)}</div>
                  </th>
                ))}
                <th className="sticky right-[160px] z-30 border-l border-border bg-[#F4F4F5] px-4 py-3">Present</th>
                <th className="sticky right-[80px] z-30 bg-[#F4F4F5] px-4 py-3">Absent</th>
                <th className="sticky right-0 z-30 border-l border-border bg-[#F4F4F5] px-4 py-3">%</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const stats = attendanceStats(s.matric_number, s.added_at, allDays, presence, cset);
                return (
                  <tr key={s.id} className="hover:bg-[#EFF6FF]">
                    <td className="sticky left-0 z-10 border-r border-b border-border bg-card px-4 py-3 text-center">{i + 1}</td>
                    <td className="sticky left-12 z-10 border-r border-b border-border bg-card px-4 py-3">
                      <div className="font-medium leading-tight">{s.name}</div>
                      <div className="text-xs text-[#A1A1AA]">{s.matric_number}</div>
                    </td>
                    {days.map((d) => {
                      const status = cellStatus(s.matric_number, d, presence, cset);
                      const isManual = manual?.get(s.matric_number)?.get(d);
                      const cellClass =
                        status === "holiday"
                          ? "bg-[#F4F4F5] text-[#71717A]"
                          : status === "present"
                          ? "bg-[#F0FDF4] text-[#16A34A]"
                          : "bg-[#FEF2F2] text-[#DC2626]";
                      return (
                        <td
                          key={d}
                          className={`relative h-10 w-10 border-r border-b border-border px-0 text-center font-mono text-[11px] font-semibold ${cellClass} ${editable && status !== "holiday" ? "cursor-pointer hover:opacity-80" : ""}`}
                          onClick={() => {
                            if (!editable || status === "holiday") return;
                            onToggle?.(s.matric_number, d, status === "present");
                          }}
                        >
                          {status === "holiday" ? "—" : status === "present" ? "✓" : "✗"}
                          {isManual && status === "present" && (
                            <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[#1C4ED8]" />
                          )}
                        </td>
                      );
                    })}
                    <td className="sticky right-[160px] z-10 border-l border-b border-border bg-card px-4 py-3 text-center font-mono">{stats.present}</td>
                    <td className="sticky right-[80px] z-10 border-b border-border bg-card px-4 py-3 text-center font-mono">{stats.absent}</td>
                    <td className="sticky right-0 z-10 border-l border-b border-border bg-card px-4 py-3 text-center font-mono font-semibold">{stats.pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DailyTab({
  students,
  attendance,
  cancelled,
}: {
  students: AeirgStudent[];
  attendance: AeirgAttendance[];
  cancelled: AeirgCancelledDay[];
}) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const iso = date ? date.toISOString().slice(0, 10) : "";
  const cset = useMemo(() => cancelledSet(cancelled), [cancelled]);
  const presence = useMemo(() => presenceMap(attendance), [attendance]);
  const isCancelled = cset.has(iso);
  const presentSet = new Set(
    attendance.filter((a) => a.attendance_date === iso).map((a) => a.matric_number),
  );
  const presentCount = students.filter((s) => presentSet.has(s.matric_number)).length;
  const dow = date?.getDay() ?? 0;
  const isWeekend = dow === 0 || dow === 6;

  function exportCsv() {
    const rows: (string | number)[][] = [["S/N", "Name", "Matric Number", "Status"]];
    students.forEach((s, i) =>
      rows.push([i + 1, s.name, s.matric_number, presentSet.has(s.matric_number) ? "Present" : "Absent"]),
    );
    downloadCsv(rows, `AEIRG_Attendance_${iso}.csv`);
  }

  return (
    <div className="grid md:grid-cols-[auto_1fr] gap-6">
      <Card>
        <CardContent className="p-3">
          <Calendar mode="single" selected={date} onSelect={setDate} className="pointer-events-auto" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{iso}</CardTitle>
          {!isCancelled && !isWeekend && presentSet.size > 0 && (
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
          )}
        </CardHeader>
        <CardContent>
          {isWeekend ? (
            <p className="text-muted-foreground">Weekends are not working days.</p>
          ) : isCancelled ? (
            <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
              This day was marked as a holiday/cancelled day.
            </div>
          ) : presentSet.size === 0 ? (
            <p className="text-muted-foreground">No attendance recorded for this date.</p>
          ) : (
            <>
              <p className="text-sm mb-3 font-medium">{presentCount} of {students.length} students present.</p>
              <ul className="space-y-1">
                {students.map((s) => {
                  const here = presentSet.has(s.matric_number);
                  return (
                    <li key={s.id} className="flex justify-between border-b py-1.5 text-sm">
                      <span>{s.name} <span className="text-xs text-muted-foreground">({s.matric_number})</span></span>
                      <span className={here ? "text-emerald-600 font-semibold" : "text-rose-500"}>{here ? "✓ Present" : "✗ Absent"}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StudentDetailTab({
  students,
  attendance,
  cancelled,
  startDate,
  today,
}: {
  students: AeirgStudent[];
  attendance: AeirgAttendance[];
  cancelled: AeirgCancelledDay[];
  startDate: string;
  today: string;
}) {
  const [matric, setMatric] = useState<string>(students[0]?.matric_number ?? "");
  const student = students.find((s) => s.matric_number === matric);
  const cset = useMemo(() => cancelledSet(cancelled), [cancelled]);
  const presence = useMemo(() => presenceMap(attendance), [attendance]);
  const days = useMemo(() => workingDaysBetween(startDate, today), [startDate, today]);
  if (!student) return <p className="text-muted-foreground">No students.</p>;
  const stats = attendanceStats(student.matric_number, student.added_at, days, presence, cset);

  function exportCsv() {
    const rows: (string | number)[][] = [["Date", "Day", "Status"]];
    for (const d of days) {
      const status = cset.has(d) ? "Holiday" : presence.get(student!.matric_number)?.has(d) ? "Present" : "Absent";
      rows.push([d, dayName(d), status]);
    }
    downloadCsv(rows, `AEIRG_${student!.matric_number}_${today}.csv`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="min-w-[280px]">
          <label className="mb-1 block text-xs font-medium text-[#525252]">Student</label>
          <Select value={matric} onValueChange={setMatric}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.matric_number} value={s.matric_number}>
                  {s.name} — {s.matric_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="mr-1 h-4 w-4" />CSV</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-[0.05em] text-[#525252]">Total Present</div><div className="font-mono text-2xl font-semibold text-[#16A34A]">{stats.present}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-[0.05em] text-[#525252]">Total Absent</div><div className="font-mono text-2xl font-semibold text-[#DC2626]">{stats.absent}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-[0.05em] text-[#525252]">Attendance %</div><div className="font-mono text-2xl font-semibold">{stats.pct}%</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-2 text-sm font-medium">Attendance pattern</div>
          <div className="flex flex-wrap gap-1">
            {days.map((d) => {
              const status = cset.has(d) ? "holiday" : presence.get(student.matric_number)?.has(d) ? "present" : "absent";
              const cls = status === "present" ? "bg-[#F0FDF4] text-[#16A34A]" : status === "absent" ? "bg-[#FEF2F2] text-[#DC2626]" : "bg-[#F4F4F5] text-[#71717A]";
              return <div key={d} title={`${d} — ${status}`} className={`grid h-4 w-4 place-items-center rounded-sm text-[10px] font-semibold ${cls}`}>{status === "present" ? "✓" : status === "absent" ? "✗" : "—"}</div>;
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[50vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#F4F4F5]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.05em] text-[#525252]">Date</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.05em] text-[#525252]">Day</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.05em] text-[#525252]">Status</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const status = cset.has(d) ? "Holiday" : presence.get(student.matric_number)?.has(d) ? "Present" : "Absent";
                  const cls = status === "Present" ? "text-[#16A34A]" : status === "Absent" ? "text-[#DC2626]" : "text-[#71717A]";
                  return (
                    <tr key={d} className="border-b border-border">
                      <td className="px-4 py-3 font-mono">{d}</td>
                      <td className="px-4 py-3 text-[#525252]">{dayName(d)}</td>
                      <td className={`px-4 py-3 font-mono font-semibold ${cls}`}>{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
