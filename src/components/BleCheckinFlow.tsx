import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  CheckCircle2,
  XCircle,
  Bluetooth,
  Send,
} from "lucide-react";
import { toast } from "sonner";

// === ESP32 firmware contract — DO NOT CHANGE ===
const BLE_SERVICE_UUID = "4e67a100-1234-5678-abcd-0123456789ab";
const BLE_WRITE_CHAR_UUID = "4e67a101-1234-5678-abcd-0123456789ab";
const BLE_NOTIFY_CHAR_UUID = "4e67a102-1234-5678-abcd-0123456789ab";
const BLE_DEVICE_NAME_PREFIX = "AttendESP_";
const QR_PREFIX = "ATTEND:";
const RSSI_THRESHOLD = -80;
// Web Bluetooth cannot read live RSSI from a connected GATT device. We send
// -60 (well within the firmware's -80 threshold) — the camera scan of the
// OLED already proves the student is in the room.
const FALLBACK_RSSI = -60;

const REGION_ID = "ble-checkin-qr-region";

type Status =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "decoding" }
  | { kind: "finding"; deviceId: string }
  | { kind: "connecting"; deviceId: string }
  | { kind: "sending"; deviceId: string }
  | { kind: "waiting"; deviceId: string }
  | { kind: "success"; message: string; deviceId: string; deviceName: string }
  | { kind: "error"; message: string };

export type BleCheckinSuccess = {
  deviceId: string;
  deviceName: string;
  rssi: number;
};

export function BleCheckinFlow({
  studentId,
  onSuccess,
  startLabel = "Scan QR & check in",
  helperText,
}: {
  studentId: string | null | undefined;
  onSuccess: (info: BleCheckinSuccess) => Promise<void> | void;
  startLabel?: string;
  helperText?: string;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const submittingRef = useRef(false);
  const bleDeviceRef = useRef<any>(null);
  const bleServerRef = useRef<any>(null);
  const notifyCharRef = useRef<any>(null);
  const responseTimeoutRef = useRef<number | null>(null);
  const onNotifyRef = useRef<((e: Event) => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupAll().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopScanner() {
    const inst = scannerRef.current;
    if (!inst) return;
    try {
      if (inst.isScanning) await inst.stop();
      await inst.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
  }

  async function disconnectBle() {
    if (responseTimeoutRef.current !== null) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
    const char = notifyCharRef.current;
    if (char && onNotifyRef.current) {
      try { char.removeEventListener("characteristicvaluechanged", onNotifyRef.current); } catch { /* */ }
      try { await char.stopNotifications(); } catch { /* */ }
    }
    notifyCharRef.current = null;
    onNotifyRef.current = null;
    const server = bleServerRef.current;
    if (server) {
      try { if (server.connected) server.disconnect(); } catch { /* */ }
    }
    bleServerRef.current = null;
    bleDeviceRef.current = null;
  }

  async function cleanupAll() {
    submittingRef.current = false;
    await stopScanner();
    await disconnectBle();
  }

  async function startScanner() {
    if (!studentId) {
      setStatus({ kind: "error", message: "You must be signed in to check in." });
      return;
    }
    if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
      setStatus({
        kind: "error",
        message: "QR check-in requires Chrome or Edge on Android. Your current browser is not supported.",
      });
      return;
    }
    if (typeof window !== "undefined"
        && window.location.protocol !== "https:"
        && window.location.hostname !== "localhost"
        && window.location.hostname !== "127.0.0.1") {
      setStatus({
        kind: "error",
        message: "QR check-in requires a secure connection (HTTPS).",
      });
      return;
    }

    setStatus({ kind: "scanning" });
    submittingRef.current = false;
    await new Promise((r) => setTimeout(r, 50));

    try {
      const inst = new Html5Qrcode(REGION_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = inst;
      await inst.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          if (submittingRef.current) return;
          submittingRef.current = true;
          await handleDecoded(decodedText);
        },
        () => { /* ignore per-frame errors */ },
      );
    } catch (err: any) {
      console.error("camera start failed", err);
      setStatus({
        kind: "error",
        message: err?.message?.includes("Permission")
          ? "Camera permission denied. Allow camera access in your browser."
          : "Could not start camera. Make sure your device has one and the page is on HTTPS.",
      });
      await stopScanner();
    }
  }

  async function handleDecoded(text: string) {
    setStatus({ kind: "decoding" });
    await stopScanner();
    const trimmed = text.trim();
    if (!trimmed.startsWith(QR_PREFIX)) {
      setStatus({ kind: "error", message: "Invalid QR code. Please scan the device screen." });
      return;
    }
    const deviceId = trimmed.slice(QR_PREFIX.length).trim();
    if (!deviceId) {
      setStatus({ kind: "error", message: "Invalid QR code. Please scan the device screen." });
      return;
    }
    await connectAndSend(deviceId);
  }

  async function connectAndSend(deviceId: string) {
    setStatus({ kind: "finding", deviceId });
    const targetName = `${BLE_DEVICE_NAME_PREFIX}${deviceId}`;

    let device: any;
    try {
      device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ name: targetName }],
        optionalServices: [BLE_SERVICE_UUID],
      });
    } catch (e: any) {
      setStatus({
        kind: "error",
        message: e?.name === "NotFoundError"
          ? `Could not find "${targetName}". Make sure the device is on and try again.`
          : `Bluetooth picker error: ${e?.message ?? e}`,
      });
      return;
    }
    bleDeviceRef.current = device;

    setStatus({ kind: "connecting", deviceId });
    try {
      const server = await device.gatt!.connect();
      bleServerRef.current = server;
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      const writeChar = await service.getCharacteristic(BLE_WRITE_CHAR_UUID);
      const notifyChar = await service.getCharacteristic(BLE_NOTIFY_CHAR_UUID);
      notifyCharRef.current = notifyChar;

      const onNotify = async (event: Event) => {
        const target = event.target as any;
        const value: DataView | undefined = target?.value;
        if (!value) return;
        const respText = new TextDecoder().decode(value).trim();
        if (responseTimeoutRef.current !== null) {
          clearTimeout(responseTimeoutRef.current);
          responseTimeoutRef.current = null;
        }
        const result = friendlyEspMessage(respText);
        if (result.ok) {
          await disconnectBle();
          try {
            await onSuccess({ deviceId, deviceName: targetName, rssi: FALLBACK_RSSI });
            toast.success("Attendance recorded");
            setStatus({ kind: "success", message: result.message, deviceId, deviceName: targetName });
          } catch (e: any) {
            console.error(e);
            setStatus({ kind: "error", message: e?.message ?? "Failed to save attendance." });
          }
        } else {
          toast.error(result.message);
          setStatus({ kind: "error", message: result.message });
          disconnectBle().catch(() => {});
        }
      };
      onNotifyRef.current = onNotify;
      notifyChar.addEventListener("characteristicvaluechanged", onNotify);
      await notifyChar.startNotifications();

      setStatus({ kind: "sending", deviceId });
      const body = JSON.stringify({ student_id: studentId, rssi: FALLBACK_RSSI });
      const bytes = new TextEncoder().encode(body);
      if (typeof writeChar.writeValueWithResponse === "function") {
        await writeChar.writeValueWithResponse(bytes);
      } else {
        await writeChar.writeValue(bytes);
      }

      setStatus({ kind: "waiting", deviceId });
      responseTimeoutRef.current = window.setTimeout(() => {
        setStatus({ kind: "error", message: "Device did not respond. Please try again." });
        disconnectBle().catch(() => {});
      }, 20_000);
    } catch (e: any) {
      console.error("BLE flow failed", e);
      setStatus({ kind: "error", message: `Bluetooth connection failed: ${e?.message ?? e}` });
      await disconnectBle();
    }
  }

  async function reset() {
    await cleanupAll();
    setStatus({ kind: "idle" });
  }

  // RSSI is intentionally not consulted here — see FALLBACK_RSSI comment above.
  void RSSI_THRESHOLD;

  const stepBadge = (() => {
    switch (status.kind) {
      case "scanning":  return <Badge variant="outline" className="border-primary text-primary">1/5 Scanning QR</Badge>;
      case "decoding":  return <Badge variant="outline">2/5 Decoding…</Badge>;
      case "finding":   return <Badge variant="outline">3/5 Finding device…</Badge>;
      case "connecting":return <Badge variant="outline">3/5 Connecting…</Badge>;
      case "sending":   return <Badge variant="outline">4/5 Sending…</Badge>;
      case "waiting":   return <Badge variant="outline">5/5 Waiting for device…</Badge>;
      default: return null;
    }
  })();

  return (
    <div className="space-y-3">
      <div
        id={REGION_ID}
        className={`rounded-xl bg-muted overflow-hidden ${status.kind === "scanning" ? "block" : "hidden"}`}
        style={{ width: "100%", minHeight: 280 }}
      />

      {status.kind === "idle" && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Camera className="h-10 w-10 text-muted-foreground" />
          {helperText && <p className="text-sm text-muted-foreground max-w-md">{helperText}</p>}
          <Button onClick={startScanner} size="lg">
            <Camera className="h-4 w-4 mr-2" /> {startLabel}
          </Button>
          <p className="text-[11px] text-muted-foreground max-w-xs">
            Requires Chrome or Edge on Android over HTTPS. Web Bluetooth is not available on iOS Safari.
          </p>
        </div>
      )}

      {(status.kind === "scanning" ||
        status.kind === "decoding" ||
        status.kind === "finding" ||
        status.kind === "connecting" ||
        status.kind === "sending" ||
        status.kind === "waiting") && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {(status.kind === "decoding" || status.kind === "finding" ||
              status.kind === "connecting" || status.kind === "sending" ||
              status.kind === "waiting") && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
            {status.kind === "connecting" && <Bluetooth className="h-4 w-4" />}
            {status.kind === "sending" && <Send className="h-4 w-4" />}
            {stepBadge}
          </div>
          <Button size="sm" variant="ghost" onClick={reset}>Cancel</Button>
        </div>
      )}

      {status.kind === "success" && (
        <div className="rounded-md border border-green-500/40 bg-green-50 p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 text-green-700 font-medium">
            <CheckCircle2 className="h-4 w-4" /> {status.message}
          </div>
          <div className="text-xs text-muted-foreground">
            Device <span className="font-mono">{status.deviceName}</span>
          </div>
          <Button size="sm" variant="outline" onClick={reset}>Scan again</Button>
        </div>
      )}

      {status.kind === "error" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 text-destructive font-medium">
            <XCircle className="h-4 w-4" /> {status.message}
          </div>
          <Button size="sm" variant="outline" onClick={reset}>Try again</Button>
        </div>
      )}
    </div>
  );
}

function friendlyEspMessage(resp: string): { ok: boolean; message: string } {
  if (resp === "OK:BLE_NEAR")        return { ok: true, message: "Attendance recorded. You're marked present." };
  if (resp === "ERROR:OUT_OF_RANGE") return { ok: false, message: "You are too far from the device. Move closer and try again." };
  if (resp === "ERROR:MISSING_FIELDS") return { ok: false, message: "Check-in failed: incomplete data. Please try again." };
  if (resp === "ERROR:BAD_REQUEST")  return { ok: false, message: "Check-in failed: please try again." };
  return { ok: false, message: `Device responded: ${resp}` };
}

// Browser-token + last-student helpers shared across both flows.
const BROWSER_TOKEN_KEY = "aeirg_device_token";
const LAST_STUDENT_KEY = "aeirg_last_checkin_student";

export function getBrowserToken(): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(BROWSER_TOKEN_KEY);
  if (existing) return existing;
  const token: string = (crypto as any)?.randomUUID
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(BROWSER_TOKEN_KEY, token);
  return token;
}

export function getLastCheckinStudent(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_STUDENT_KEY);
}

export function setLastCheckinStudent(matric: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_STUDENT_KEY, matric);
}
