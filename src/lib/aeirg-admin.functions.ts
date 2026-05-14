// AEIRG admin server function — single dispatcher gated by password verification.
// File MUST stay thin (only createServerFn + imports) per server-fn rules.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase-client.server";

const Schema = z.object({
  password: z.string().min(1),
  op: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional(),
});

export const aeirgAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data }) => {
    // Verify password via RPC.
    const verify = await supabaseAdmin.rpc("aeirg_verify_password", { _password: data.password } as any);
    if (verify.error || !verify.data) {
      throw new Error("Invalid admin password");
    }
    const args = (data.args ?? {}) as Record<string, any>;
    const sb = supabaseAdmin as any;

    switch (data.op) {
      case "addStudent": {
        const r = await sb.from("aeirg_students").insert({
          name: args.name, matric_number: args.matric_number,
        }).select().single();
        if (r.error) throw new Error(r.error.message);
        return r.data;
      }
      case "updateStudentName": {
        const r = await sb.from("aeirg_students")
          .update({ name: args.name }).eq("id", args.id);
        if (r.error) throw new Error(r.error.message);
        return { ok: true };
      }
      case "deleteStudent": {
        const r = await sb.from("aeirg_students").delete().eq("id", args.id);
        if (r.error) throw new Error(r.error.message);
        return { ok: true };
      }
      case "toggleAttendance": {
        // If currently present → delete; else insert (manually_added=true).
        if (args.currentlyPresent) {
          const r = await sb.from("aeirg_attendance").delete()
            .eq("matric_number", args.matric_number)
            .eq("attendance_date", args.attendance_date);
          if (r.error) throw new Error(r.error.message);
        } else {
          const r = await sb.from("aeirg_attendance").upsert({
            matric_number: args.matric_number,
            attendance_date: args.attendance_date,
            manually_added: true,
            source_packet_id: null,
          }, { onConflict: "matric_number,attendance_date" });
          if (r.error) throw new Error(r.error.message);
        }
        return { ok: true };
      }
      case "cancelDay": {
        const r = await sb.from("aeirg_cancelled_days").upsert({
          cancelled_date: args.cancelled_date, reason: args.reason ?? null,
        }, { onConflict: "cancelled_date" });
        if (r.error) throw new Error(r.error.message);
        return { ok: true };
      }
      case "uncancelDay": {
        const r = await sb.from("aeirg_cancelled_days").delete().eq("id", args.id);
        if (r.error) throw new Error(r.error.message);
        return { ok: true };
      }
      case "reassignPacket": {
        const r1 = await sb.from("aeirg_attendance").delete()
          .eq("source_packet_id", args.packet_id).eq("manually_added", false);
        if (r1.error) throw new Error(r1.error.message);
        const pkt = await sb.from("aeirg_raw_packets").select("matric_numbers_json")
          .eq("id", args.packet_id).single();
        if (pkt.error) throw new Error(pkt.error.message);
        const matrics: string[] = pkt.data.matric_numbers_json ?? [];
        const r2 = await sb.from("aeirg_raw_packets").update({ assigned_date: args.new_date })
          .eq("id", args.packet_id);
        if (r2.error) throw new Error(r2.error.message);
        if (matrics.length > 0) {
          const rows = matrics.map((m) => ({
            matric_number: m, attendance_date: args.new_date,
            source_packet_id: args.packet_id, manually_added: false,
          }));
          const r3 = await sb.from("aeirg_attendance").upsert(rows, {
            onConflict: "matric_number,attendance_date", ignoreDuplicates: true,
          });
          if (r3.error) throw new Error(r3.error.message);
        }
        return { ok: true };
      }
      case "deletePacket": {
        const r1 = await sb.from("aeirg_attendance").delete()
          .eq("source_packet_id", args.packet_id).eq("manually_added", false);
        if (r1.error) throw new Error(r1.error.message);
        const r2 = await sb.from("aeirg_raw_packets").delete().eq("id", args.packet_id);
        if (r2.error) throw new Error(r2.error.message);
        return { ok: true };
      }
      case "updateConfig": {
        const r = await sb.from("aeirg_admin_config").update({
          it_period_end_date: args.it_period_end_date ?? null,
        }).eq("id", 1);
        if (r.error) throw new Error(r.error.message);
        return { ok: true };
      }
      case "changePassword": {
        const r = await supabaseAdmin.rpc("aeirg_update_password", {
          _current: args.current_password, _new: args.new_password,
        } as any);
        if (r.error) throw new Error(r.error.message);
        if (!r.data) throw new Error("Current password incorrect");
        return { ok: true };
      }
      default:
        throw new Error("Unknown op: " + data.op);
    }
  });
