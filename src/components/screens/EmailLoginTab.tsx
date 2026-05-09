"use client";

import { useState, type FormEvent } from "react";
import { Bell, LockKeyhole, Mail, Rocket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { isValidEmail } from "@/lib/validation";

interface EmailLoginTabProps {
  onAuthenticated?: () => void;
}

export function EmailLoginTab({ onAuthenticated: _onAuthenticated }: EmailLoginTabProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!isValidEmail(email)) {
      setMsg({ ok: false, text: "Zadej prosím platný e-mail." });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/public-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setMsg({ ok: false, text: "E-mail se nepodařilo uložit. Zkus to prosím za chvíli." });
        return;
      }

      setMsg({ ok: true, text: "Díky. Jakmile veřejnou Učebnu spustíme, dáme ti vědět." });
      setEmail("");
    } catch {
      setMsg({ ok: false, text: "Síťová chyba. Zkus to prosím za chvíli znovu." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#71b0ff]/24 bg-[#07111f]/55 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#71b0ff]/18 text-[#9fcbff]">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#9fcbff]">Veřejný přístup připravujeme</p>
            <h2 className="mt-2 text-xl font-black text-[color:var(--theme-text)]">Učebna je teď určená hlavně pro tábory Weeks.</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--theme-muted)]">
              Přihlášení e-mailem a vytváření účtů pro veřejnost je zatím vypnuté. Studenti na táboře vstupují přes denní PIN a číslo studenta, lektor přes lektorský PIN.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Rocket, title: "Vývoj běží", text: "Ladíme domácí postup, účty a ukládání pokroku." },
          { icon: Bell, title: "Dáme vědět", text: "Nech e-mail a ozveme se při veřejném spuštění." },
          { icon: Mail, title: "Bez účtu", text: "Tímhle formulářem si účet nevytváříš." },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <item.icon className="h-5 w-5 text-[#2dd4a6]" />
            <p className="mt-3 text-sm font-black text-white">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-white/52">{item.text}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <label htmlFor="public-waitlist-email" className="block text-sm font-bold text-white/82">
          Chci info o vydání pro veřejnost
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="public-waitlist-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
            required
          />
          <Button type="submit" size="md" className="shrink-0" disabled={busy}>
            {busy ? "Ukládám…" : "Upozornit mě"}
          </Button>
        </div>
        {msg && (
          <p className={`text-sm ${msg.ok ? "text-[color:var(--theme-success)]" : "text-red-400"}`}>
            {msg.text}
          </p>
        )}
      </form>
    </div>
  );
}
