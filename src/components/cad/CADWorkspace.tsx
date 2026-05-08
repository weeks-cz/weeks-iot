"use client";
import { useEffect, useRef } from "react";
import { useCADReducer } from "./hooks/useCADReducer";
import { Plane } from "./Plane";
import { Palette } from "./Palette";
import { TopBar } from "./TopBar";
import { ZoomControls } from "./ZoomControls";
import { WireLayer } from "./WireLayer";
import { SAVE_DEBOUNCE_MS } from "@/lib/cad/constants";
import type { Circuit, ComponentType } from "@/types/cad";

interface Props {
  taskId: string;
  taskTitle: string;
  initialCircuit: Circuit;
  palette: ComponentType[];
  onSave: (c: Circuit) => void;
  onClose: () => void;
  onReset: () => void;
  readOnly?: boolean;
}

export function CADWorkspace({
  taskId, taskTitle, initialCircuit, palette, onSave, onClose, onReset, readOnly,
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
          <WireLayer planeRef={planeRef} state={state} dispatch={dispatch} />
          <ZoomControls zoom={state.zoom} dispatch={dispatch} />
        </div>
      </div>
    </div>
  );
}
