import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "student" | "lecturer" | "course_rep";

export interface AppUser {
  id: string;
  email: string | null;
  matric_number: string | null;
  full_name: string;
  role: AppRole | null;
  rfid_card_id: string | null;
  fingerprint_id: number | null;
}

interface AuthCtx {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (matricOrEmail: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function matricToEmail(matric: string) {
  return matric.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() + "@attendclass.app";
}

async function loadAppUser(authUser: User): Promise<AppUser> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("matric_number, full_name, rfid_card_id, fingerprint_id")
    .eq("id", authUser.id)
    .maybeSingle();
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", authUser.id)
    .maybeSingle();
  return {
    id: authUser.id,
    email: authUser.email ?? null,
    matric_number: profile?.matric_number ?? null,
    full_name: profile?.full_name ?? "",
    rfid_card_id: profile?.rfid_card_id ?? null,
    fingerprint_id: profile?.fingerprint_id ?? null,
    role: (roleRow?.role as AppRole | undefined) ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener first, then getSession (avoids race).
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      if (sess?.user) {
        // Defer profile load to avoid deadlock inside callback.
        setTimeout(() => {
          loadAppUser(sess.user).then(setUser);
        }, 0);
      } else {
        setUser(null);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        setUser(await loadAppUser(data.session.user));
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(identifier: string, password: string) {
    const id = identifier.trim();
    const email = id.includes("@") ? id.toLowerCase() : matricToEmail(id);
    const pw = password.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  async function refresh() {
    if (session?.user) setUser(await loadAppUser(session.user));
  }

  return (
    <Ctx.Provider value={{ user, session, loading, signIn, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
