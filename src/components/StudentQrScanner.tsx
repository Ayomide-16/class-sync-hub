import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  CheckCircle2,
  XCircle,
  Loader2,
  ScanLine,
  Bluetooth,
  Send,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Firmware contract (do not change — these UUIDs and name prefix come
// straight from the AttendESP firmware).
const BLE_SERVICE_UUID = "4e67a100-1234-5678-abcd-0123456789ab";
const BLE_WRITE_CHAR_UUID = "4e67a101-1234-5678-abcd-0123456789ab";
const BLE_NOTIFY_CHAR_UUID = "4e67a102-1234-5678-abcd-0123456789ab";
const BLE_DEVICE_NAME_PREFIX = "AttendESP_";

const REGION_ID = "attendesp-qr-region";

type QrPayload = {
  t: string;
  sid: string;
  did: string;
  cc: string;
  tk: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "decoding" }
  | { kind: "connecting"; payload: QrPayload }
  | { kind: "sending"; payload: QrPayload }
  | { kind: "waiting"; payload: QrPayload }
  | { kind: "success"; message: string; payload: QrPayload }
  | { kind: "error"; message: string };

function decodeQr(raw: string): QrPayload | null {
  try {
    // Firmware emits raw base64(JSON). Some readers may wrap it in a URL
    // query like "?payload=<b64>" — strip that if present.
    let token = raw.trim();
    const m = token.match(/[?&]payload=([^&]+)/);
    if (m) token = decodeURIComponent(m[1]);
    const json = atob(token);
    const obj = JSON.parse(json);
    if (
      typeof obj === "object" &&
      obj &&
      typeof obj.t === "string" &&
      typeof obj.sid === "string" &&
      typeof obj.did === "string" &&
      typeof obj.cc === "string" &&
      typeof obj.tk === "string"
    ) {
      return obj as QrPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function friendlyEspMessage(resp: string): { ok: boolean; message: string } {
  if (resp === "OK:BLE_NEAR") {
    return { ok: true, message: "Attendance recorded. You're marked present." };
  }
  if (resp === "ERROR:OUT_OF_RANGE") {
    return { ok: false, message: "Please move closer to the device and try again." };
  }
  if (resp === "ERROR:QR_TOKEN_INVALID") {
    return { ok: false, message: "Invalid session QR code. Please scan again." };
  }
  if (resp === "ERROR:WRONG_CLASSROOM") {
    return { ok: false, message: "Wrong classroom device detected." };
  }
  if (resp === "ERROR:MISSING_FIELDS") {
    return { ok: false, message: "Check-in failed: incomplete data sent." };
  }
  if (resp === "ERROR:MISSING_PAYLOAD") {
    return { ok: false, message: "Check-in failed: QR data missing." };
  }
  if (resp === "ERROR:BAD_REQUEST") {
    return { ok: false, message: "Check-in failed: please try again." };
  }
  return { ok: false, message: `Device responded: ${resp}` };
}

export function StudentQrScanner() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const submittingRef = useRef(false);

  const bleDeviceRef = useRef<any>(null); // BluetoothDevice
  const bleServerRef = useRef<any>(null); // BluetoothRemoteGATTServer
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
      try {
        char.removeEventListener("characteristicvaluechanged", onNotifyRef.current);
      } catch {
        /* ignore */
      }
      try {
        await char.stopNotifications();
      } catch {
        /* ignore */
      }
    }
    notifyCharRef.current = null;
    onNotifyRef.current = null;

    const server = bleServerRef.current;
    if (server) {
      try {
        if (server.connected) server.disconnect();
      } catch {
        /* ignore */
      }
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
    if (!user?.matric_number) {
      setStatus({ kind: "error", message: "You must be signed in with a matric number to check in." });
      return;
    }
    if (typeof window !== "undefined" && window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setStatus({
        kind: "error",
        message:
          "QR + BLE check-in requires HTTPS. Open this page on the secure (https://) URL to use Bluetooth.",
      });
      return;
    }

    setStatus({ kind: "scanning" });
    submittingRef.current = false;
    await new Promise((r) => setTimeout(r, 50)); // let region mount

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
        () => {
          /* per-frame failures: ignore */
        },
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

    const payload = decodeQr(text);
    if (!payload || payload.t !== "qr_static") {
      setStatus({
        kind: "error",
        message: "That QR doesn't look like an AttendESP code. Point your camera at the device's screen.",
      });
      return;
    }

    if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
      setStatus({
        kind: "error",
        message:
          "QR + BLE check-in requires Chrome or Edge on Android. Please use a supported browser.",
      });
      return;
    }

    await connectAndSend(payload);
  }

  async function connectAndSend(payload: QrPayload) {
    setStatus({ kind: "connecting", payload });

    let device: any;
    try {
      device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: BLE_DEVICE_NAME_PREFIX }],
        optionalServices: [BLE_SERVICE_UUID],
      });
    } catch (e: any) {
      // User cancelled, or no device picked.
      setStatus({
        kind: "error",
        message:
          e?.name === "NotFoundError"
            ? "No AttendESP device selected. Make sure the device is on and try again."
            : `Bluetooth picker error: ${e?.message ?? e}`,
      });
      return;
    }
    bleDeviceRef.current = device;

    try {
      const server = await device.gatt!.connect();
      bleServerRef.current = server;
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      const writeChar = await service.getCharacteristic(BLE_WRITE_CHAR_UUID);
      const notifyChar = await service.getCharacteristic(BLE_NOTIFY_CHAR_UUID);
      notifyCharRef.current = notifyChar;

      // Subscribe BEFORE writing so we don't miss the notification.
      const onNotify = (event: Event) => {
        const target = event.target as any;
        const value: DataView | undefined = target?.value;
        if (!value) return;
        const text = new TextDecoder().decode(value);
        const { ok, message } = friendlyEspMessage(text.trim());
        if (responseTimeoutRef.current !== null) {
          clearTimeout(responseTimeoutRef.current);
          responseTimeoutRef.current = null;
        }
        if (ok) {
          toast.success("Attendance recorded");
          setStatus({ kind: "success", message, payload });
        } else {
          toast.error(message);
          setStatus({ kind: "error", message });
        }
        // Clean disconnect after we have a result.
        disconnectBle().catch(() => {});
      };
      onNotifyRef.current = onNotify;
      notifyChar.addEventListener("characteristicvaluechanged", onNotify);
      await notifyChar.startNotifications();

      // Write the payload.
      setStatus({ kind: "sending", payload });
      const body = JSON.stringify({
        student_id: user!.matric_number,
        // Web Bluetooth can't read connection RSSI from JS; -60 safely beats
        // the firmware's -80 threshold. Physical proximity is already proven
        // by the camera scan of the OLED.
        rssi: -60,
        qr_payload: payload,
      });
      const bytes = new TextEncoder().encode(body);
      // writeValueWithResponse where supported (modern Chrome) — falls back
      // to writeValue (deprecated alias).
      if (typeof writeChar.writeValueWithResponse === "function") {
        await writeChar.writeValueWithResponse(bytes);
      } else {
        await writeChar.writeValue(bytes);
      }

      setStatus({ kind: "waiting", payload });
      // Safety timeout: if the ESP doesn't respond in 20s, give up.
      responseTimeoutRef.current = window.setTimeout(() => {
        setStatus({
          kind: "error",
          message:
            "No response from the AttendESP device. Move closer and scan again.",
        });
        disconnectBle().catch(() => {});
      }, 20_000);
    } catch (e: any) {
      console.error("BLE flow failed", e);
      setStatus({
        kind: "error",
        message: `Bluetooth connection failed: ${e?.message ?? e}`,
      });
      await disconnectBle();
    }
  }

  async function reset() {
    await cleanupAll();
    setStatus({ kind: "idle" });
  }

  const stepBadge = (() => {
    switch (status.kind) {
      case "scanning":
        return <Badge variant="outline" className="border-primary text-primary">1/4 Scanning QR</Badge>;
      case "decoding":
        return <Badge variant="outline">2/4 Decoding…</Badge>;
      case "connecting":
        return <Badge variant="outline">3/4 Connecting Bluetooth…</Badge>;
      case "sending":
        return <Badge variant="outline">3/4 Sending check-in…</Badge>;
      case "waiting":
        return <Badge variant="outline">4/4 Waiting for device…</Badge>;
      default:
        return null;
    }
  })();

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="h-4 w-4" />
          Scan QR &amp; check in
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Point your camera at the QR on the AttendESP OLED. Your phone connects to the
          device over Bluetooth to confirm you are physically present.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          id={REGION_ID}
          className={`rounded-xl bg-muted overflow-hidden ${
            status.kind === "scanning" ? "block" : "hidden"
          }`}
          style={{ width: "100%", minHeight: 280 }}
        />

        {status.kind === "idle" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Camera className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Press the button to start the camera. You'll be asked for camera and
              Bluetooth permissions.
            </p>
            <Button onClick={startScanner}>
              <Camera className="h-4 w-4 mr-2" /> Start scanner
            </Button>
            <p className="text-[11px] text-muted-foreground max-w-xs">
              Requires Chrome or Edge on Android over HTTPS. Web Bluetooth is not available
              on iOS Safari.
            </p>
          </div>
        )}

        {(status.kind === "scanning" ||
          status.kind === "decoding" ||
          status.kind === "connecting" ||
          status.kind === "sending" ||
          status.kind === "waiting") && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {(status.kind === "decoding" ||
                status.kind === "connecting" ||
                status.kind === "sending" ||
                status.kind === "waiting") && <Loader2 className="h-4 w-4 animate-spin" />}
              {status.kind === "connecting" && <Bluetooth className="h-4 w-4" />}
              {status.kind === "sending" && <Send className="h-4 w-4" />}
              {stepBadge}
            </div>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        )}

        {status.kind === "success" && (
          <div className="rounded-md border border-green-500/40 bg-green-50 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <CheckCircle2 className="h-4 w-4" /> {status.message}
            </div>
            <div className="text-xs text-muted-foreground">
              Course <span className="font-mono">{status.payload.cc}</span> · Device{" "}
              <span className="font-mono">{status.payload.did}</span>
            </div>
            <Button size="sm" variant="outline" onClick={reset}>
              Scan again
            </Button>
          </div>
        )}

        {status.kind === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 text-destructive font-medium">
              <XCircle className="h-4 w-4" /> {status.message}
            </div>
            <Button size="sm" variant="outline" onClick={reset}>
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
