"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
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
      className="flex min-h-screen items-center justify-center p-4"
    >
      <PanelGlass className="w-full max-w-sm">
        {/* Header row: topic + admin button */}
        <div className="mb-4 flex items-center justify-between text-xs text-[color:var(--theme-muted)]">
          <span>
            Téma: <strong className="text-[color:var(--theme-text)]">{topic?.label ?? "—"}</strong>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "CHANGE_TOPIC" })}
              className="topic-change-button rounded-md border border-white/15 px-2 py-1 hover:border-white/30"
            >
              Změnit téma
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="rounded-md border border-white/15 px-2 py-1 hover:border-white/30"
            >
              Admin
            </button>
          </div>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-center">Weeks IoT</h1>

        {/* Mode toggle */}
        <div className="mb-4 flex rounded-lg border border-white/10 overflow-hidden text-sm">
          <button
            type="button"
            className={`flex-1 py-2 transition-colors ${
              mode === "student"
                ? "bg-[color:var(--theme-accent-soft)] text-[color:var(--theme-accent)]"
                : "hover:bg-white/5"
            }`}
            onClick={() => { setMode("student"); setError(null); }}
          >
            Student
          </button>
          <button
            type="button"
            className={`flex-1 py-2 transition-colors ${
              mode === "lecturer"
                ? "bg-[color:var(--theme-accent-soft)] text-[color:var(--theme-accent)]"
                : "hover:bg-white/5"
            }`}
            onClick={() => { setMode("lecturer"); setError(null); }}
          >
            Lektor
          </button>
          <button
            type="button"
            className={`flex-1 py-2 transition-colors ${
              mode === "email"
                ? "bg-[color:var(--theme-accent-soft)] text-[color:var(--theme-accent)]"
                : "hover:bg-white/5"
            }`}
            onClick={() => { setMode("email"); setError(null); }}
          >
            Email
          </button>
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
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-center text-2xl tracking-widest focus:border-[color:var(--theme-accent)] focus:outline-none"
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
              className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-center text-xl tracking-widest focus:border-[color:var(--theme-accent)] focus:outline-none"
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
    </motion.div>
  );
}
