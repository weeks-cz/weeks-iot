"use client";
import { useEffect } from "react";
import { useGameState } from "@/components/providers/GameStateProvider";
import { CADWorkspace } from "./CADWorkspace";
import { applyTaskSeed, createDefaultCircuit } from "@/lib/cad/circuit";
import { findTask } from "@/lib/tasks";

interface Props {
  taskId: string;
  open: boolean;
  onClose: () => void;
}

export default function CADModal({ taskId, open, onClose }: Props) {
  const { state, dispatch } = useGameState();
  const task = findTask(taskId);

  // Side-load wokwi/elements once when modal opens
  useEffect(() => {
    if (!open) return;
    void import("@wokwi/elements");
  }, [open]);

  if (!open || !task || !task.cad) return null;

  const initialCircuit = state.circuits[taskId] ?? applyTaskSeed(task);
  const palette = task.cad.palette;

  return (
    <div className="fixed inset-0 z-[60] bg-black/95">
      <CADWorkspace
        taskId={taskId}
        taskTitle={task.title}
        initialCircuit={initialCircuit}
        palette={palette}
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
