"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { useGameState } from "@/components/providers/GameStateProvider";
import { verifyPin, type PinLevel } from "@/lib/pin";
import { notifyAccountCreated } from "@/lib/account-email";
import { getTopicById } from "@/lib/topics";

export function PinEntry() {
  const { state, dispatch, emailFromUrl } = useGameState();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Email form (added 2026-04-26)
  const [email, setEmail] = useState(emailFromUrl ?? "");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; message: string } | null>(null);

  const topic = getTopicById(state.selectedTopic);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Try admin first (longest), then lecturer, then daily
    const levels: PinLevel[] = ["admin", "lecturer", "daily"];
    const matched = levels.find((l) => verifyPin(value, l));
    if (!matched) {
      setError("Špatný PIN. Zkus znovu.");
      return;
    }

    dispatch({ type: "SET_PIN_LEVEL", level: matched });
    dispatch({
      type: "SET_SCREEN",
      screen: { currentScreen: matched === "admin" ? "admin" : "task-list", pinLevel: matched },
    });
  }

  async function handleAccountLink(e: FormEvent) {
    e.preventDefault();
    setEmailBusy(true);
    setEmailMsg(null);
    const result = await notifyAccountCreated(email);
    setEmailMsg({
      ok: result.ok,
      message: result.message ?? (result.ok ? "Hotovo." : "Nepodařilo se."),
    });
    if (result.ok) {
      dispatch({ type: "SET_ACCOUNT_EMAIL", email });
    }
    setEmailBusy(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex min-h-screen items-center justify-center p-4"
    >
      <PanelGlass className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-between text-xs text-[color:var(--theme-muted)]">
          <span>
            Téma: <strong className="text-[color:var(--theme-text)]">{topic?.label ?? "—"}</strong>
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: "CHANGE_TOPIC" })}
            className="topic-change-button rounded-md border border-white/15 px-2 py-1 hover:border-white/30"
          >
            Změnit téma
          </button>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-center">Weeks IoT</h1>
        <p className="mb-6 text-center text-sm text-[color:var(--theme-muted)]">
          Zadej PIN pro vstup
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-center text-2xl tracking-widest focus:border-[color:var(--theme-accent)] focus:outline-none"
            placeholder="● ● ● ●"
            autoFocus
          />
          {error && <p className="text-center text-sm text-red-400">{error}</p>}
          <Button type="submit" size="lg" className="w-full">
            Vstoupit
          </Button>
        </form>

        <hr className="my-6 border-white/10" />

        <form onSubmit={handleAccountLink} className="space-y-3">
          <p className="text-xs text-[color:var(--theme-muted)]">
            Propojit účet s e-mailem (volitelné — pošleme ti odkaz na pokračování):
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
            placeholder="jmeno@example.com"
            autoComplete="email"
          />
          <Button type="submit" variant="ghost" size="sm" disabled={emailBusy || !email}>
            {emailBusy ? "Odesílám…" : "Poslat odkaz"}
          </Button>
          {emailMsg && (
            <p
              className={`text-xs ${
                emailMsg.ok ? "text-[color:var(--theme-success)]" : "text-red-400"
              }`}
            >
              {emailMsg.message}
            </p>
          )}
        </form>
      </PanelGlass>
    </motion.div>
  );
}
