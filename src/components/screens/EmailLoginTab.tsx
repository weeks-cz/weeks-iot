"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail } from "@/lib/validation";

type SubMode = "login" | "register" | "magic";

export function EmailLoginTab() {
  const [subMode, setSubMode] = useState<SubMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (subMode === "register") {
      if (password.length < 6) { setMsg({ ok: false, text: "Heslo musí mít aspoň 6 znaků." }); return; }
      if (password !== password2) { setMsg({ ok: false, text: "Hesla se neshodují." }); return; }
      if (nickname.trim().length < 2) { setMsg({ ok: false, text: "Nickname musí mít aspoň 2 znaky." }); return; }
    }
    if (subMode !== "magic" && password.length === 0) {
      setMsg({ ok: false, text: "Zadej heslo." }); return;
    }
    if (!isValidEmail(email)) { setMsg({ ok: false, text: "Zadej platný email." }); return; }

    const supabase = createClient();
    setBusy(true);

    if (subMode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname: nickname.trim() } },
      });
      if (error) { setBusy(false); setMsg({ ok: false, text: error.message }); return; }
      setMsg({ ok: true, text: "Účet vytvořen, přihlašuji…" });
      // leave busy=true — component unmounts on SIGNED_IN
    } else if (subMode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setBusy(false); setMsg({ ok: false, text: error.message }); return; }
      setMsg({ ok: true, text: "Přihlášeno, načítám…" });
      // leave busy=true — component unmounts on SIGNED_IN
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) { setBusy(false); setMsg({ ok: false, text: error.message }); return; }
      setBusy(false); // magic link: no navigation, user stays on screen
      setMsg({ ok: true, text: "Mrkni do mailu — poslali jsme ti přihlašovací odkaz." });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
        {(["login", "register", "magic"] as SubMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`flex-1 py-2 transition-colors ${
              subMode === m
                ? "bg-[color:var(--theme-accent-soft)] text-[color:var(--theme-accent)]"
                : "hover:bg-white/5"
            }`}
            onClick={() => { setSubMode(m); setMsg(null); }}
          >
            {m === "login" ? "Mám účet" : m === "register" ? "Vytvořit účet" : "Poslat odkaz"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
          required
        />
        {subMode !== "magic" && (
          <input
            type="password"
            autoComplete={subMode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Heslo"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
            required
          />
        )}
        {subMode === "register" && (
          <>
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Heslo znovu"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
              required
            />
            <input
              type="text"
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Nickname (2–20 znaků, povinný)"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
              required
            />
          </>
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
    </div>
  );
}
