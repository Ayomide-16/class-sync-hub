// One-off seeding endpoint. Called by setup tooling (idempotent).
// POST { students: [{matric, name}], lecturer: {matric, name}, courseRep: {matric, name} }
// Creates auth users (synthetic email), assigns roles. Skips users that already exist.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function matricToEmail(matric: string) {
  return matric.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() + "@attendclass.app";
}
function passwordFor(name: string) {
  return name.trim().split(/\s+/)[0].toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = await req.json().catch(() => ({}));
  const students: { matric: string; name: string }[] = body.students ?? [];
  const lecturer: { matric: string; name: string } | null = body.lecturer ?? null;
  const courseRep: { matric: string; name: string } | null = body.courseRep ?? null;

  const results = { students: 0, lecturer: 0, courseRep: 0, skipped: 0, errors: [] as string[] };

  async function createUser(matric: string, name: string, role: "student" | "lecturer" | "course_rep") {
    const email = matricToEmail(matric);
    const password = passwordFor(name);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { matric_number: matric, full_name: name, role },
    });
    if (error) {
      if (String(error.message).toLowerCase().includes("already")) {
        results.skipped++;
        return null;
      }
      results.errors.push(`${matric}: ${error.message}`);
      return null;
    }
    return data.user?.id ?? null;
  }

  for (const s of students) {
    const id = await createUser(s.matric, s.name, "student");
    if (id) results.students++;
  }
  if (lecturer) {
    const id = await createUser(lecturer.matric, lecturer.name, "lecturer");
    if (id) results.lecturer++;
  }
  if (courseRep) {
    const id = await createUser(courseRep.matric, courseRep.name, "course_rep");
    if (id) results.courseRep++;
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
