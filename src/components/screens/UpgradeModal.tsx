"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/lib/payments/plans";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UpgradeModal({ open, onClose }: Props) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  const [billingName, setBillingName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    const supabase = createClient();
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      setMsg({ ok: false, text: "Chyba ověření — opakuj prosím." });
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          period,
          billingName: billingName.trim() || undefined,
        }),
      });

      if (response.status === 200) {
        const data = await response.json();
        window.location.href = data.redirectUrl;
        return;
      }

      if (response.status === 503) {
        setMsg({
          ok: false,
          text: "Platby zatím nejsou zapnuté — zkus to prosím později.",
        });
        return;
      }

      // Other errors
      const error = await response.text();
      setMsg({
        ok: false,
        text: error || "Chyba při zpracování platby — zkus to prosím později.",
      });
    } catch (e) {
      setMsg({
        ok: false,
        text: "Chyba při zpracování platby — zkus to prosím později.",
      });
    } finally {
      setBusy(false);
    }
  }

  const monthlyPrice = PLANS.monthly.priceKc;
  const yearlyPrice = PLANS.yearly.priceKc;
  const savingsKc = monthlyPrice * 12 - yearlyPrice;

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
              <h2 className="text-2xl font-bold">Weeks Premium</h2>
              <button onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1.5 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-[color:var(--theme-muted)]">
              Odemkni všechny sekce a užívej si plný obsah bez omezení.
            </p>

            {/* Period cards */}
            <div className="space-y-2">
              {/* Monthly */}
              <button
                type="button"
                onClick={() => setPeriod("monthly")}
                className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                  period === "monthly"
                    ? "border-[color:var(--theme-accent)] bg-[color:var(--theme-accent-soft)]"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-[color:var(--theme-text)]">
                      {monthlyPrice} Kč / měsíc
                    </div>
                    <div className="text-xs text-[color:var(--theme-muted)] mt-1">
                      Kdykoliv zrušit
                    </div>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      period === "monthly"
                        ? "border-[color:var(--theme-accent)] bg-[color:var(--theme-accent)]"
                        : "border-white/20"
                    }`}
                  >
                    {period === "monthly" && <Check className="h-3 w-3 text-[#0d1427]" />}
                  </div>
                </div>
              </button>

              {/* Yearly */}
              <button
                type="button"
                onClick={() => setPeriod("yearly")}
                className={`w-full rounded-xl border-2 p-4 text-left transition-all relative ${
                  period === "yearly"
                    ? "border-[color:var(--theme-accent)] bg-[color:var(--theme-accent-soft)]"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="absolute -top-2 right-3 rounded-full bg-[color:var(--theme-accent)] px-2.5 py-0.5 text-[10px] font-bold text-[#0d1427]">
                  Nejlepší cena
                </div>
                <div className="flex items-start justify-between pt-2">
                  <div>
                    <div className="font-semibold text-[color:var(--theme-text)]">
                      {yearlyPrice} Kč / rok
                    </div>
                    <div className="text-xs text-[color:var(--theme-success)] mt-1">
                      ušetříš {savingsKc} Kč
                    </div>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      period === "yearly"
                        ? "border-[color:var(--theme-accent)] bg-[color:var(--theme-accent)]"
                        : "border-white/20"
                    }`}
                  >
                    {period === "yearly" && <Check className="h-3 w-3 text-[#0d1427]" />}
                  </div>
                </div>
              </button>
            </div>

            {/* Info note */}
            <p className="text-sm rounded-lg bg-[color:var(--theme-accent-soft)] text-[color:var(--theme-accent)] px-3 py-2">
              Platbu zadává rodič. Po zaplacení se všechny sekce odemknou hned.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                value={billingName}
                onChange={(e) => setBillingName(e.target.value)}
                placeholder="Jméno rodiče (na doklad, volitelné)"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 h-12 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
              />

              {msg && (
                <p className={`text-sm ${msg.ok ? "text-[color:var(--theme-success)]" : "text-red-400"}`}>
                  {msg.text}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Zpracovávám…" : `Přejít na platbu (${period === "monthly" ? monthlyPrice : yearlyPrice} Kč)`}
              </Button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
