"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { BadgeCheck, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { useGameState } from "@/components/providers/GameStateProvider";
import { verifyPin } from "@/lib/pin";
import { getTopicById } from "@/lib/topics";
import { EmailLoginTab } from "@/components/screens/EmailLoginTab";

type LoginMode = "student" | "lecturer" | "email";

export function PinEntry() {
  const { state, dispatch } = useGameState();
  const router = useRouter();

  const [mode, setMode] = useState<LoginMode>("student");
  const [pin, setPin] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  const topic = getTopicById(state.selectedTopic);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "student") {
      if (!verifyPin(pin, "daily", state.config)) {
        setError("Špatný PIN. Zkus znovu.");
        return;
      }
      const num = studentNumber.replace(/\D/g, "");
      if (!num) {
        setError("Zadej číslo studenta.");
        return;
      }
      const n = Number(num);
      if (n < 1 || n > state.config.maxStudents) {
        setError(`Číslo studenta musí být 1 až ${state.config.maxStudents}.`);
        return;
      }
      dispatch({ type: "LOGIN_STUDENT", studentNumber: num });
    } else {
      // lecturer mode — single PIN, no student number
      if (!verifyPin(pin, "lecturer", state.config)) {
        setError("Špatný lektor PIN. Zkus znovu.");
        return;
      }
      dispatch({
        type: "SET_SCREEN",
        screen: { currentScreen: "task-list", pinLevel: "lecturer" },
      });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex min-h-screen flex-col items-center justify-center p-4 gap-6"
    >
      {/* Logo */}
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--theme-accent)]">
          <BadgeCheck className="h-4 w-4" />
          Táborový přístup
        </div>
        <div className="text-4xl font-black text-[color:var(--theme-accent)] tracking-tight mb-2">
          Weeks Učebna
        </div>
        <div className="mx-auto max-w-md text-sm leading-6 text-[color:var(--theme-muted)]">
          Část: <strong className="text-[color:var(--theme-text)]">{topic?.label ?? "—"}</strong>. Vstup pro studenty a lektory z táborů Weeks, veřejný přístup připravujeme.
        </div>
      </div>

      <PanelGlass className="w-full max-w-2xl space-y-5">
        {/* Mode tabs — pill style */}
        <div className="flex gap-2 p-1 bg-black/20 rounded-2xl">
          {([
            { id: "student", label: "Student", icon: KeyRound },
            { id: "email", label: "Veřejnost", icon: Mail },
            { id: "lecturer", label: "Lektor", icon: ShieldCheck },
          ] as Array<{ id: LoginMode; label: string; icon: typeof KeyRound }>).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setMode(item.id); setError(null); }}
              className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mode === item.id
                  ? "bg-[color:var(--theme-accent)] text-[#0d1427]"
                  : "text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)]"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        {mode === "email" ? (
          <EmailLoginTab />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 h-14 text-center text-2xl tracking-widest focus:border-[color:var(--theme-accent)] focus:outline-none"
              placeholder={mode === "student" ? "Denní PIN" : "Lektor PIN"}
              autoFocus
            />
            {mode === "student" && (
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={String(state.config.maxStudents).length}
                value={studentNumber}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  if (!digits) { setStudentNumber(""); return; }
                  const n = Number(digits);
                  if (n > state.config.maxStudents) {
                    setStudentNumber(String(state.config.maxStudents));
                  } else {
                    setStudentNumber(digits);
                  }
                }}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 h-14 text-center text-xl tracking-widest focus:border-[color:var(--theme-accent)] focus:outline-none"
                placeholder={`Číslo studenta (1–${state.config.maxStudents})`}
              />
            )}
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
            <Button type="submit" size="lg" className="w-full">
              Vstoupit
            </Button>
          </form>
        )}
      </PanelGlass>

      {/* Utility links */}
      <div className="flex gap-4 text-sm text-[color:var(--theme-muted)]">
        <button
          type="button"
          onClick={() => dispatch({ type: "CHANGE_TOPIC" })}
          className="hover:text-[color:var(--theme-text)] transition-colors"
        >
          Změnit téma
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="hover:text-[color:var(--theme-text)] transition-colors"
        >
          Admin
        </button>
      </div>
    </motion.div>
  );
}
