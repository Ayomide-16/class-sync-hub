import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode } from "lucide-react";

/**
 * Single QR component used by both student and lecturer.
 * Payload string MUST match the format AttendESP firmware reads.
 *
 * Student QR  -> matric number only (e.g. "2022/1/86884ET").
 *                The ESP camera scans this for QR+BLE check-in.
 *
 * Lecturer QR -> "ATTENDESP|<device_id>|<course_code>|<schedule_id>".
 *                Displayed on screen at the front of the class so
 *                students can verify the room/device is correct.
 */
export function QrPanel({
  title,
  subtitle,
  payload,
  caption,
  tone = "primary",
}: {
  title: string;
  subtitle?: string;
  payload: string;
  caption?: string;
  tone?: "primary" | "accent";
}) {
  return (
    <Card className={tone === "accent" ? "border-accent/40" : "border-primary/30"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4" />
          {title}
        </CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <div className="rounded-xl bg-white p-4 shadow-inner">
          <QRCodeSVG
            value={payload}
            size={208}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#0f172a"
          />
        </div>
        <Badge variant="outline" className="font-mono text-[11px] break-all max-w-full whitespace-normal text-center">
          {payload}
        </Badge>
        {caption && (
          <p className="text-xs text-muted-foreground text-center max-w-xs">{caption}</p>
        )}
      </CardContent>
    </Card>
  );
}
