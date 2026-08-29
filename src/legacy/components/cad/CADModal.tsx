"use client";
import { useEffect, useState } from "react";
import { useGameState } from "@legacy/components/providers/GameStateProvider";
import { CADWorkspace } from "./CADWorkspace";
import { applyTaskSeed, isCircuitEmpty } from "@legacy/lib/cad/circuit";
import { registerBreadboardHalf } from "@legacy/lib/cad/register-breadboard";
import { findTask } from "@legacy/lib/tasks";

interface Props {
  taskId: string;
  open: boolean;
  onClose: () => void;
}

export default function CADModal({ taskId, open, onClose }: Props) {
  const { state, dispatch } = useGameState();
  const [wokwiLoaded, setWokwiLoaded] = useState(false);
  const task = findTask(taskId);

  useEffect(() => {
    if (!open) return;
    registerBreadboardHalf();
    import("@wokwi/elements").then(() => setWokwiLoaded(true));
  }, [open]);

  if (!open || !task || !task.cad) return null;

  if (!wokwiLoaded) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95">
        <span className="text-sm text-white/60">Načítám komponenty…</span>
      </div>
    );
  }

  const savedCircuit = state.circuits[taskId];
  const initialCircuit =
    savedCircuit && !isCircuitEmpty(savedCircuit) ? savedCircuit : applyTaskSeed(task);
  const palette = task.cad.palette;

  return (
    <div className="fixed inset-0 z-[60] bg-black/95">
      <CADWorkspace
        taskId={taskId}
        taskTitle={task.title}
        initialCircuit={initialCircuit}
        palette={palette}
        hints={task.hints}
        readOnly={state.adminPreviewActive}
        onSave={(circuit) => dispatch({ type: "SAVE_CIRCUIT", taskId, circuit })}
        onReset={() => {
          if (confirm("Resetovat obvod do výchozího stavu?")) {
            const fresh = applyTaskSeed(task);
            dispatch({ type: "SAVE_CIRCUIT", taskId, circuit: fresh });
          }
        }}
        onClose={onClose}
      />
    </div>
  );
}
