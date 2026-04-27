"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    // Listener subscription FIRST — fires INITIAL_SESSION immediately on subscribe,
    // then continues to fire on auth changes. getSession() below is a backup
    // in case the initial event is delayed.
    // POZOR: Nikdy nevolat Supabase queries v tomhle callbacku — způsobuje deadlock.
    // Veškeré DB volání musí být v separátním useEffect.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, sess: Session | null) => {
      if (!mounted) return;
      setSession(sess);
      setLoading(false);
    });

    // Initial state fetch (fallback if listener INITIAL_SESSION is delayed)
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
    // Empty deps: this effect must run exactly once on mount. supabase client
    // is created from createClient() which returns a fresh instance per call,
    // but we capture it in module scope for stability.
  }, []);

  const signOut = async () => {
    // Clear local state immediately for instant UI feedback; listener will fire
    // SIGNED_OUT shortly after as redundant confirmation.
    setSession(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
