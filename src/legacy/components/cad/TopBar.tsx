"use client";
import { ArrowLeft, RotateCcw } from "lucide-react";

interface Props {
  taskTitle: string;
  onClose: () => void;
  onReset: () => void;
  readOnly?: boolean;
}

export function TopBar({ taskTitle, onClose, onReset, readOnly }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-2">
      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm hover:border-white/30"
      >
        <ArrowLeft className="h-4 w-4" /> Zpět
      </button>
      <h1 className="text-sm font-medium text-white/90">
        {taskTitle}
        {readOnly && <span className="ml-2 text-xs text-amber-400">(jen čtení — admin preview)</span>}
      </h1>
      <button
        type="button"
        onClick={onReset}
        disabled={readOnly}
        className="flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm hover:border-red-500/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw className="h-4 w-4" /> Reset
      </button>
    </header>
  );
}
