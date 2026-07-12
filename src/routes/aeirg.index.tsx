import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
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
      const { data, error } = await supabase.from("aeirg_students" as any)
        .select("id, name, matric_number, added_at, must_change_password");
      if (error) throw error;
      return (data ?? []) as unknown as AeirgStudent[];
    },
  });
  const attendance = useQuery({
    queryKey: ["aeirg", "attendance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("aeirg_public_attendance" as any);
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
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold truncate">AEIRG IT Attendance</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{new Date(today + "T12:00:00Z").toDateString()}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">AttendClass Home</Button>
              <Button variant="ghost" size="sm" className="sm:hidden">Home</Button>
            </Link>
            <Link to="/aeirg/login">
              <Button variant="outline" size="sm">Login</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !hasData ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No attendance data yet. Once the ESP syncs the first packet for an AEIRG
              student, this register will populate automatically.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="register" className="space-y-4">
            <div className="overflow-x-auto -mx-4 px-4">
              <TabsList className="w-max">
                <TabsTrigger value="register"><FileSpreadsheet className="h-4 w-4 mr-1" />Student Register</TabsTrigger>
                <TabsTrigger value="daily"><CalIcon className="h-4 w-4 mr-1" />Daily View</TabsTrigger>
                <TabsTrigger value="student"><Users className="h-4 w-4 mr-1" />Student Detail</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="register">
              <RegisterTab
                students={sortBySurname(students.data ?? [])}
                attendance={attendance.data ?? []}
                cancelled={cancelled.data ?? []}
                startDate={startDate}
                today={today}
              />
            </TabsContent>
            <TabsContent value="daily">
              <DailyTab
                students={sortBySurname(students.data ?? [])}
                attendance={attendance.data ?? []}
                cancelled={cancelled.data ?? []}
              />
            </TabsContent>
            <TabsContent value="student">
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
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} min={startDate} max={to} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button size="sm" onClick={exportXlsx}><Download className="h-4 w-4 mr-1" />XLSX</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[70vh] relative border-t">
          <table className="text-sm border-collapse">
            <thead className="bg-muted sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 bg-muted z-30 px-2 py-2 text-left border-r w-12">S/N</th>
                <th className="sticky left-12 bg-muted z-30 px-2 py-2 text-left border-r min-w-[200px]">Student</th>
                {days.map((d) => {
                  const isToday = d === today;
                  return (
                    <th key={d} className={`px-2 py-2 text-xs whitespace-nowrap border-r ${cset.has(d) ? "text-amber-600" : ""} ${isToday ? "bg-primary/15 text-primary" : ""}`}>
                      {cset.has(d) ? "—" : d.slice(5)}
                      <div className="text-[10px] font-normal opacity-60">{cset.has(d) ? "Holiday" : isToday ? "Today" : dayName(d)}</div>
                    </th>
                  );
                })}
                <th aria-hidden className="p-0 border-0" style={{ minWidth: 240, width: 240 }} />
                <th className="sticky right-[160px] bg-muted z-30 px-2 py-2 border-l">Present</th>
                <th className="sticky right-[80px] bg-muted z-30 px-2 py-2">Absent</th>
                <th className="sticky right-0 bg-muted z-30 px-2 py-2 border-l">%</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const stats = attendanceStats(s.matric_number, s.added_at, allDays, presence, cset);
                return (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="sticky left-0 bg-card z-10 px-2 py-1.5 border-r border-b text-center">{i + 1}</td>
                    <td className="sticky left-12 bg-card z-10 px-2 py-1.5 border-r border-b">
                      <div className="font-medium leading-tight">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.matric_number}</div>
                    </td>
                    {days.map((d) => {
                      const status = cellStatus(s.matric_number, d, presence, cset);
                      const isManual = manual?.get(s.matric_number)?.get(d);
                      const isToday = d === today;
                      const cellClass =
                        status === "holiday"
                          ? "text-muted-foreground"
                          : status === "present"
                          ? "text-emerald-600 font-semibold"
                          : "text-rose-500";
                      return (
                        <td
                          key={d}
                          className={`px-2 py-1.5 text-center border-r border-b relative ${cellClass} ${isToday ? "bg-primary/5" : ""} ${editable && status !== "holiday" ? "cursor-pointer hover:bg-accent" : ""}`}
                          onClick={() => {
                            if (!editable || status === "holiday") return;
                            onToggle?.(s.matric_number, d, status === "present");
                          }}
                        >
                          {status === "holiday" ? "—" : status === "present" ? "✓" : "✗"}
                          {isManual && status === "present" && (
                            <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                          )}
                        </td>
                      );
                    })}
                    <td aria-hidden className="p-0 border-0" style={{ minWidth: 240, width: 240 }} />
                    <td className="sticky right-[160px] bg-card z-10 px-2 py-1.5 text-center border-l border-b">{stats.present}</td>
                    <td className="sticky right-[80px] bg-card z-10 px-2 py-1.5 text-center border-b">{stats.absent}</td>
                    <td className="sticky right-0 bg-card z-10 px-2 py-1.5 text-center border-l border-b font-semibold">{stats.pct}%</td>
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
          <label className="text-xs text-muted-foreground">Student</label>
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
        <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Present</div><div className="text-2xl font-bold text-emerald-600">{stats.present}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Absent</div><div className="text-2xl font-bold text-rose-500">{stats.absent}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Attendance %</div><div className="text-2xl font-bold">{stats.pct}%</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium mb-2">Attendance pattern</div>
          <div className="flex flex-wrap gap-1">
            {days.map((d) => {
              const status = cset.has(d) ? "holiday" : presence.get(student.matric_number)?.has(d) ? "present" : "absent";
              const cls = status === "present" ? "bg-emerald-500" : status === "absent" ? "bg-rose-400" : "bg-muted";
              return <div key={d} title={`${d} — ${status}`} className={`h-4 w-4 rounded-sm ${cls}`} />;
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[50vh]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Day</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const status = cset.has(d) ? "Holiday" : presence.get(student.matric_number)?.has(d) ? "Present" : "Absent";
                  const cls = status === "Present" ? "text-emerald-600" : status === "Absent" ? "text-rose-500" : "text-muted-foreground";
                  return (
                    <tr key={d} className="border-b">
                      <td className="px-3 py-1.5">{d}</td>
                      <td className="px-3 py-1.5">{dayName(d)}</td>
                      <td className={`px-3 py-1.5 font-medium ${cls}`}>{status}</td>
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
