"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { syncToCloud, emitEvent } from "@/lib/cloud-sync";
import { useGameState } from "@/components/providers/GameStateProvider";
import { isValidEmail } from "@/lib/validation";

type SubMode = "register" | "login" | "magic";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LinkAccountModal({ open, onClose }: Props) {
  const { state, dispatch } = useGameState();
  const [subMode, setSubMode] = useState<SubMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (subMode === "register") {
      if (password.length < 6) { setMsg({ ok: false, text: "Heslo musí mít aspoň 6 znaků." }); return; }
      if (password !== password2) { setMsg({ ok: false, text: "Hesla se neshodují." }); return; }
    }
    if (!isValidEmail(email)) { setMsg({ ok: false, text: "Zadej platný email." }); return; }

    const supabase = createClient();
    setBusy(true);

    try {
      if (subMode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: state.account.nickname ?? null } },
        });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        const userId = data.user?.id;
        if (!userId) { setMsg({ ok: false, text: "Účet vytvořen, ale chybí session — opakuj prosím." }); return; }

        dispatch({ type: "SET_LINKED_USER", userId });
        // První zápis po propojení účtu → bezpodmínečný (null), řádek nemusí existovat.
        await syncToCloud({ ...state, linkedUserId: userId }, null);
        await emitEvent(userId, { event_type: "signup", metadata: { source: "pin-link" } });

        setMsg({ ok: true, text: "Účet propojen ✓" });
        setTimeout(onClose, 1200);
      } else if (subMode === "login") {
        if (!window.confirm("Po přihlášení nahradíš svůj současný postup tím v cloudu. Pokračovat?")) {
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        setMsg({ ok: true, text: "Přihlášeno, načítám…" });
        setTimeout(onClose, 800);
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        setMsg({ ok: true, text: "Mrkni do mailu — link je tam." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="panel-glass w-full max-w-md p-8 space-y-5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-bold">Propojit účet</h2>
              <button onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1.5 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-[color:var(--theme-muted)]">
              Vytvoř si účet emailem a heslem pro pokračování doma. Tvůj současný postup
              ({state.currentStudentNumber ? `Student ${state.currentStudentNumber}` : ""}) zůstane.
            </p>

            {/* Pill tabs */}
            <div className="flex gap-2 p-1 bg-black/20 rounded-2xl">
              {(["register", "login", "magic"] as SubMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    subMode === m
                      ? "bg-[color:var(--theme-accent)] text-[#0d1427]"
                      : "text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)]"
                  }`}
                  onClick={() => { setSubMode(m); setMsg(null); }}
                >
                  {m === "register" ? "Vytvořit" : m === "login" ? "Mám účet" : "Poslat odkaz"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 h-12 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
              />
              {subMode !== "magic" && (
                <input
                  type="password" autoComplete={subMode === "register" ? "new-password" : "current-password"} required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Heslo"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 h-12 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
                />
              )}
              {subMode === "register" && (
                <input
                  type="password" autoComplete="new-password" required
                  value={password2} onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Heslo znovu"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 h-12 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
                />
              )}
              {msg && (
                <p className={`text-sm ${msg.ok ? "text-[color:var(--theme-success)]" : "text-red-400"}`}>
                  {msg.text}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Pracuji…" : subMode === "register" ? "Vytvořit účet" : subMode === "login" ? "Přihlásit" : "Poslat odkaz"}
              </Button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
