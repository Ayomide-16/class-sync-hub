import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScanLine } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase-client";
import {
  BleCheckinFlow,
  getBrowserToken,
  getLastCheckinStudent,
  setLastCheckinStudent,
  type BleCheckinSuccess,
} from "@/components/BleCheckinFlow";

/**
 * Wrapper used on the main student dashboard. The hardware records the
 * actual attendance row (via `hardware-sync`); we only flag the multi-
 * student-on-one-browser case here.
 */
export function StudentQrScanner() {
  const { user } = useAuth();

  async function onSuccess(info: BleCheckinSuccess) {
    if (!user?.matric_number) return;
    const last = getLastCheckinStudent();
    if (last && last !== user.matric_number) {
      try {
        await supabase.rpc("record_checkin_flag" as any, {
          _browser_token: getBrowserToken(),
          _first_student_id: last,
          _attempted_student_id: user.matric_number,
          _ble_device: info.deviceName,
          _source: "main",
        } as any);
      } catch (e) {
        console.warn("Failed to record check-in flag", e);
      }
    }
    setLastCheckinStudent(user.matric_number);
  }

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
      <CardContent>
        <BleCheckinFlow
          studentId={user?.matric_number ?? null}
          onSuccess={onSuccess}
          helperText="Press the button to start the camera. You'll be asked for camera and Bluetooth permissions."
        />
      </CardContent>
    </Card>
  );
}
