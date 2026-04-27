"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { validateTaskCode } from "@/lib/task-solutions";
import { useGameState } from "@/components/providers/GameStateProvider";
import type { ValidationResult } from "@/types";

interface Props {
  taskId: string;
  onSuccess: () => void;
}

export function CodeValidator({ taskId, onSuccess }: Props) {
  const { state, dispatch } = useGameState();
  const [code, setCode] = useState(state.codeDrafts[taskId] ?? "");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [checking, setChecking] = useState(false);

  function handleChange(value: string) {
    setCode(value);
    if (result) setResult(null);
    dispatch({ type: "SET_CODE_DRAFT", taskId, draft: value });
  }

  function handleCheck() {
    setChecking(true);
    setResult(null);
    // setTimeout lets React repaint the spinner before the (synchronous) validation runs
    setTimeout(() => {
      const r = validateTaskCode(taskId, code);
      setResult(r);
      setChecking(false);
      if (r.ok) onSuccess();
    }, 50);
  }

  return (
    <div className="space-y-3">
      <textarea
        value={code}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
        rows={8}
        placeholder="// sem vlož svůj Arduino kód..."
        spellCheck={false}
      />
      <Button onClick={handleCheck} disabled={!code.trim() || checking}>
        {checking ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Kontroluji…
          </>
        ) : (
          "Zkontrolovat"
        )}
      </Button>
      {result && (
        <div
          className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
            result.ok
              ? "bg-[color:var(--theme-success)]/10 text-[color:var(--theme-success)]"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {result.ok ? <Check className="h-5 w-5 shrink-0" /> : <X className="h-5 w-5 shrink-0" />}
          <div>{result.ok ? "Super! Úkol splněn." : (result.message ?? "Zkus to znovu.")}</div>
        </div>
      )}
    </div>
  );
}
