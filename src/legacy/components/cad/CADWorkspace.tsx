"use client";
import { useEffect, useRef } from "react";
import { useCADReducer } from "./hooks/useCADReducer";
import { Plane } from "./Plane";
import { Palette } from "./Palette";
import { TopBar } from "./TopBar";
import { ZoomControls } from "./ZoomControls";
import { SAVE_DEBOUNCE_MS } from "@legacy/lib/cad/constants";
import type { Circuit, ComponentType } from "@legacy/types/cad";

interface HintsPanelProps {
  hints: { code?: string; wiring?: string };
}

function HintsPanel({ hints }: HintsPanelProps) {
  if (!hints.code && !hints.wiring) return null;
  return (
    <aside className="w-56 flex-shrink-0 overflow-y-auto border-l border-white/10 bg-black/60 p-3">
      {hints.wiring && (
        <section className="mb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">
            Zapojení
          </h4>
          <p className="whitespace-pre-line text-xs leading-relaxed text-white/70">
            {hints.wiring}
          </p>
        </section>
      )}
      {hints.code && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-300">
            Kód
          </h4>
          <p className="whitespace-pre-line text-xs leading-relaxed text-white/70">
            {hints.code}
          </p>
        </section>
      )}
    </aside>
  );
}

interface Props {
  taskId: string;
  taskTitle: string;
  initialCircuit: Circuit;
  palette: ComponentType[];
  hints?: { code?: string; wiring?: string };
  onSave: (c: Circuit) => void;
  onClose: () => void;
  onReset: () => void;
  readOnly?: boolean;
}

export function CADWorkspace({
  taskId, taskTitle, initialCircuit, palette, hints, onSave, onClose, onReset, readOnly,
}: Props) {
  const [state, dispatch] = useCADReducer(initialCircuit);
  const planeRef = useRef<HTMLDivElement>(null);
  const lastSyncedRef = useRef<Circuit>(initialCircuit);

  // Debounced sync to GameState
  useEffect(() => {
    if (readOnly) return;
    if (state.circuit === lastSyncedRef.current) return;
    const handle = setTimeout(() => {
      onSave(state.circuit);
      lastSyncedRef.current = state.circuit;
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [state.circuit, onSave, readOnly]);

  // Keyboard: Esc cancels in-progress wire OR closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state.wireInProgress) dispatch({ type: "CANCEL_WIRE" });
        else onClose();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && state.selection && !readOnly) {
        if (state.selection.kind === "component") {
          dispatch({ type: "DELETE_COMPONENT", id: state.selection.id });
        } else if (state.selection.kind === "wire") {
          dispatch({ type: "DELETE_WIRE", id: state.selection.id });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.wireInProgress, state.selection, onClose, readOnly]);

  return (
    <div className="flex h-full w-full flex-col bg-[color:var(--theme-bg)]">
      <TopBar taskTitle={taskTitle} onClose={onClose} onReset={onReset} readOnly={readOnly} />
      <div className="flex flex-1 overflow-hidden">
        <Palette palette={palette} disabled={readOnly} />
        <div className="relative flex-1 overflow-hidden">
          <Plane ref={planeRef} state={state} dispatch={dispatch} readOnly={readOnly} />
          <ZoomControls zoom={state.zoom} dispatch={dispatch} />
        </div>
        {hints && <HintsPanel hints={hints} />}
      </div>
    </div>
  );
}
