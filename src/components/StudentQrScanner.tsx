import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CheckCircle2, XCircle, Loader2, ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "submitting"; payload: string }
  | { kind: "success"; message: string; course_code?: string }
  | { kind: "error"; message: string };

const REGION_ID = "attendesp-qr-region";

export function StudentQrScanner() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    return () => {
      // Cleanup on unmount.
      stopScanner().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopScanner() {
    const inst = scannerRef.current;
    if (!inst) return;
    try {
      if (inst.isScanning) {
        await inst.stop();
      }
      await inst.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
  }

  async function startScanner() {
    setStatus({ kind: "scanning" });
    submittingRef.current = false;

    // Wait one tick so the DOM region exists.
    await new Promise((r) => setTimeout(r, 50));

    try {
      const inst = new Html5Qrcode(REGION_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = inst;

      await inst.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
        },
        async (decodedText) => {
          if (submittingRef.current) return;
          submittingRef.current = true;
          await handleDecoded(decodedText);
        },
        () => {
          /* per-frame decode failures: ignore */
        },
      );
    } catch (err: any) {
      console.error("camera start failed", err);
      setStatus({
        kind: "error",
        message:
          err?.message?.includes("Permission")
            ? "Camera permission denied. Allow camera access in your browser."
            : "Could not start camera. Make sure your device has one and the page is on HTTPS.",
      });
      await stopScanner();
    }
  }

  async function handleDecoded(text: string) {
    setStatus({ kind: "submitting", payload: text });
    await stopScanner();

    if (!text.startsWith("ATTENDESP|")) {
      setStatus({
        kind: "error",
        message: "Not an AttendESP QR code. Point your camera at the device's screen.",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("student-checkin", {
        body: { payload: text },
      });
      if (error) {
        const detail = (data as any)?.detail || (data as any)?.error || error.message;
        setStatus({ kind: "error", message: detail || "Check-in failed." });
        return;
      }
      if ((data as any)?.duplicate) {
        toast.info("Already checked in for this class");
        setStatus({ kind: "success", message: "You're already marked present.", course_code: (data as any)?.course_code });
        return;
      }
      toast.success("Attendance recorded");
      setStatus({
        kind: "success",
        message: "Attendance recorded.",
        course_code: (data as any)?.course_code,
      });
    } catch (e: any) {
      console.error("checkin invoke failed", e);
      setStatus({ kind: "error", message: e?.message ?? "Network error." });
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="h-4 w-4" />
          Check in
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Scan the QR code shown on the AttendESP device or the lecturer's screen.
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
              Press the button to open your camera and check in.
            </p>
            <Button onClick={startScanner}>
              <Camera className="h-4 w-4 mr-2" /> Start scanner
            </Button>
          </div>
        )}

        {status.kind === "scanning" && (
          <div className="flex justify-between items-center">
            <Badge variant="outline" className="border-primary text-primary">
              Scanning…
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await stopScanner();
                setStatus({ kind: "idle" });
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {status.kind === "submitting" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Submitting check-in…
          </div>
        )}

        {status.kind === "success" && (
          <div className="rounded-md border border-green-500/40 bg-green-50 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <CheckCircle2 className="h-4 w-4" /> {status.message}
            </div>
            {status.course_code && (
              <div className="text-xs text-muted-foreground">
                Course: <span className="font-mono">{status.course_code}</span>
              </div>
            )}
            <Button size="sm" variant="outline" onClick={startScanner}>
              Scan again
            </Button>
          </div>
        )}

        {status.kind === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 text-destructive font-medium">
              <XCircle className="h-4 w-4" /> {status.message}
            </div>
            <Button size="sm" variant="outline" onClick={startScanner}>
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
