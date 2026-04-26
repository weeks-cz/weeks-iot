"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { validateTaskCode } from "@/lib/task-solutions";
import type { ValidationResult } from "@/types";

interface Props {
  taskId: string;
  onSuccess: () => void;
}

export function CodeValidator({ taskId, onSuccess }: Props) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);

  function handleCheck() {
    const r = validateTaskCode(taskId, code);
    setResult(r);
    if (r.ok) onSuccess();
  }

  return (
    <div className="space-y-3">
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
        rows={10}
        placeholder="// sem vlož svůj Arduino kód..."
        spellCheck={false}
      />
      <Button onClick={handleCheck} disabled={!code.trim()}>
        Zkontrolovat
      </Button>
      {result && (
        <div
          className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
            result.ok
              ? "bg-[color:var(--theme-success)]/10 text-[color:var(--theme-success)]"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {result.ok ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
          <div>{result.ok ? "Super! Úkol splněn." : result.message ?? "Zkus to znovu."}</div>
        </div>
      )}
    </div>
  );
}
