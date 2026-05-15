import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Maximize2 } from "lucide-react";

/**
 * Renders the EXACT same QR the AttendESP firmware shows on its OLED.
 * Firmware encodes a plain text string: `ATTEND:<DEVICE_ID>` (e.g.
 * `ATTEND:ESP32-LT101`). The student's app scans this text, finds the
 * matching `AttendESP_<DEVICE_ID>` BLE peripheral, and writes its check-in
 * payload there. No base64, no JSON wrapping.
 */
export function EspQrPanel({
  deviceId,
  courseCode,
}: {
  scheduleId?: string;
  deviceId: string;
  courseCode?: string;
}) {
  const [fullScreen, setFullScreen] = useState(false);
  const payload = useMemo(() => `ATTEND:${deviceId || "ESP32-LT101"}`, [deviceId]);

  return (
    <>
      <Card className="border-accent/40">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4" />
              Class QR (project to students)
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setFullScreen(true)}>
              <Maximize2 className="h-4 w-4 mr-1" /> Full screen
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Identical text to the QR shown on the AttendESP OLED.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <div className="rounded-xl bg-white p-4 shadow-inner">
            <QRCodeSVG
              value={payload}
              size={224}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>
          <Badge variant="outline" className="font-mono text-xs">{payload}</Badge>
          {courseCode && (
            <div className="text-xs text-muted-foreground">{courseCode}</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={fullScreen} onOpenChange={setFullScreen}>
        <DialogContent className="max-w-[100vw] sm:max-w-3xl p-6 sm:p-10">
          <DialogTitle className="text-center text-xl">
            {courseCode ? `${courseCode} — scan to check in` : "Scan to check in"}
          </DialogTitle>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-2xl bg-white p-6 shadow-xl">
              <QRCodeSVG
                value={payload}
                size={520}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>
            <div className="font-mono text-sm">{payload}</div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
