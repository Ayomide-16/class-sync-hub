import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Maximize2 } from "lucide-react";

/**
 * Renders the EXACT same QR the AttendESP firmware shows on its OLED.
 * Firmware encodes:
 *   base64( JSON.stringify({ t:"qr_static", sid, did, cc, tk }) )
 * where tk = `${sid}:${did}:${cc}`.
 *
 * Rendering only — no QR generation logic, just an image of the known
 * static payload. Lecturer projects this so students can scan from the
 * back of the hall.
 */
export function EspQrPanel({
  scheduleId,
  deviceId,
  courseCode,
}: {
  scheduleId: string;
  deviceId: string;
  courseCode: string;
}) {
  const [fullScreen, setFullScreen] = useState(false);

  const payloadB64 = useMemo(() => {
    const obj = {
      t: "qr_static",
      sid: scheduleId,
      did: deviceId,
      cc: courseCode,
      tk: `${scheduleId}:${deviceId}:${courseCode}`,
    };
    return btoa(JSON.stringify(obj));
  }, [scheduleId, deviceId, courseCode]);

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
            Identical payload to the QR shown on the AttendESP OLED.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <div className="rounded-xl bg-white p-4 shadow-inner">
            <QRCodeSVG
              value={payloadB64}
              size={208}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 w-full text-[11px]">
            <Badge variant="outline" className="font-mono whitespace-normal break-all justify-center">
              did: {deviceId}
            </Badge>
            <Badge variant="outline" className="font-mono whitespace-normal break-all justify-center">
              cc: {courseCode}
            </Badge>
            <Badge variant="outline" className="font-mono whitespace-normal break-all justify-center">
              sid: {scheduleId}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Dialog open={fullScreen} onOpenChange={setFullScreen}>
        <DialogContent className="max-w-[100vw] sm:max-w-3xl p-6 sm:p-10">
          <DialogTitle className="text-center text-xl">
            {courseCode} — scan to check in
          </DialogTitle>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-2xl bg-white p-6 shadow-xl">
              <QRCodeSVG
                value={payloadB64}
                size={460}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>
            <div className="text-sm text-muted-foreground text-center">
              Device <span className="font-mono">{deviceId}</span> · Schedule{" "}
              <span className="font-mono">{scheduleId}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
