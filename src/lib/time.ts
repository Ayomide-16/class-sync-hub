// Helpers shared across dashboards.
export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Returns {dow, time} for now in WAT (Africa/Lagos = UTC+1).
export function nowInWat(): { dow: number; time: string; date: string } {
  const d = new Date(Date.now() + 60 * 60 * 1000); // shift UTC -> WAT
  return {
    dow: d.getUTCDay(),
    time: d.toISOString().slice(11, 19),
    date: d.toISOString().slice(0, 10),
  };
}

export function formatLoggedAt(iso: string | null, raw: string | null): string {
  if (!iso) return raw === "TIME_NOT_SYNCED" ? "Not synced" : (raw ?? "—");
  // Display in WAT.
  const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  return d.toISOString().replace("T", " ").slice(0, 19) + " WAT";
}
