// AEIRG shared helpers: working-day math, matrix building, CSV/XLSX downloads.
import * as XLSX from "xlsx";

export type AeirgStudent = { id: string; name: string; matric_number: string; added_at: string };
export type AeirgAttendance = {
  id: string;
  matric_number: string;
  attendance_date: string;
  source_packet_id: string | null;
  manually_added: boolean;
};
export type AeirgCancelledDay = { id: string; cancelled_date: string; reason: string | null };

// "YYYY-MM-DD" in WAT (UTC+1) for today.
export function watToday(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Mon–Fri only working-day list between two ISO dates (inclusive).
export function workingDaysBetween(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  if (!startISO || !endISO) return out;
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function dayName(iso: string): string {
  const dow = new Date(iso + "T00:00:00Z").getUTCDay();
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow];
}

export function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1] || "").toLowerCase();
}

export function sortBySurname<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => surnameOf(a.name).localeCompare(surnameOf(b.name)));
}

// Build a presence map: { matric: Set<date> }.
export function presenceMap(att: AeirgAttendance[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const a of att) {
    if (!m.has(a.matric_number)) m.set(a.matric_number, new Set());
    m.get(a.matric_number)!.add(a.attendance_date);
  }
  return m;
}

export function manualMap(att: AeirgAttendance[]): Map<string, Map<string, boolean>> {
  const m = new Map<string, Map<string, boolean>>();
  for (const a of att) {
    if (!m.has(a.matric_number)) m.set(a.matric_number, new Map());
    m.get(a.matric_number)!.set(a.attendance_date, a.manually_added);
  }
  return m;
}

export function cancelledSet(c: AeirgCancelledDay[]): Set<string> {
  return new Set(c.map((x) => x.cancelled_date));
}

export type CellStatus = "present" | "absent" | "holiday";
export function cellStatus(
  matric: string,
  date: string,
  presence: Map<string, Set<string>>,
  cancelled: Set<string>,
): CellStatus {
  if (cancelled.has(date)) return "holiday";
  return presence.get(matric)?.has(date) ? "present" : "absent";
}

export function attendanceStats(
  matric: string,
  studentAddedAt: string,
  workingDays: string[],
  presence: Map<string, Set<string>>,
  cancelled: Set<string>,
): { present: number; absent: number; pct: number } {
  const addedDate = studentAddedAt.slice(0, 10);
  let present = 0;
  let absent = 0;
  for (const d of workingDays) {
    if (d < addedDate) continue;
    if (cancelled.has(d)) continue;
    if (presence.get(matric)?.has(d)) present++;
    else absent++;
  }
  const denom = present + absent;
  const pct = denom === 0 ? 0 : Math.round((present / denom) * 1000) / 10;
  return { present, absent, pct };
}

// ---- Downloads ----

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(rows: (string | number)[][], filename: string) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export function downloadRegisterXlsx(opts: {
  students: AeirgStudent[];
  workingDays: string[];
  cancelled: Set<string>;
  presence: Map<string, Set<string>>;
  manual?: Map<string, Map<string, boolean>>;
  filename: string;
  includeManualFlag?: boolean;
}) {
  const { students, workingDays, cancelled, presence, manual, filename, includeManualFlag } = opts;
  const headers = ["S/N", "Student Name", "Matric Number"];
  for (const d of workingDays) headers.push(cancelled.has(d) ? "HOLIDAY" : d);
  headers.push("Days Present", "Days Absent", "Attendance %");
  if (includeManualFlag) headers.push("Manual Overrides");

  const rows: (string | number)[][] = [headers];
  students.forEach((s, i) => {
    const row: (string | number)[] = [i + 1, s.name, s.matric_number];
    let manualCount = 0;
    for (const d of workingDays) {
      if (cancelled.has(d)) row.push("");
      else {
        const present = presence.get(s.matric_number)?.has(d);
        row.push(present ? "P" : "A");
        if (present && manual?.get(s.matric_number)?.get(d)) manualCount++;
      }
    }
    const stats = attendanceStats(s.matric_number, s.added_at, workingDays, presence, cancelled);
    row.push(stats.present, stats.absent, `${stats.pct}%`);
    if (includeManualFlag) row.push(manualCount > 0 ? `yes (${manualCount})` : "no");
    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Bold header
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = { font: { bold: true } };
  }
  ws["!freeze"] = { xSplit: 2, ySplit: 1 } as any;
  ws["!cols"] = headers.map((h, i) =>
    i === 1 ? { wch: 28 } : i === 2 ? { wch: 16 } : { wch: 12 },
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  triggerDownload(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  );
}
