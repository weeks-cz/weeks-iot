"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { StarBadge } from "@/components/ui/StarBadge";
import { CodeValidator } from "@/components/task/CodeValidator";
import { HelpCards } from "@/components/task/HelpCards";
import { TaskImage } from "@/components/task/TaskImage";
import { useGameState } from "@/components/providers/GameStateProvider";
import { findTask } from "@/lib/tasks";

export function TaskDetail() {
  const { state, dispatch } = useGameState();
  const taskId = state.screen.activeTaskId;
  if (!taskId) return null;
  const task = findTask(taskId);
  if (!task) return null;
  const taskState = state.tasks[taskId];
  if (!taskState) return null;

  function goBack() {
    dispatch({
      type: "SET_SCREEN",
      screen: { currentScreen: "task-list", pinLevel: state.screen.pinLevel },
    });
  }

  const completeId = taskId;
  const reward = task.reward;
  function handleSuccess() {
    dispatch({ type: "COMPLETE_TASK", taskId: completeId, reward });
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="mx-auto max-w-3xl p-6 space-y-6"
    >
      <header className="flex items-center justify-between">
        <Button variant="ghost" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zpět
        </Button>
        <StarBadge count={task.reward} />
      </header>

      <PanelGlass>
        <h1 className="mb-2 text-2xl font-bold">{task.title}</h1>
        <p className="whitespace-pre-line text-[color:var(--theme-muted)]">
          {task.description}
        </p>
      </PanelGlass>

      {task.imageKey && (
        <PanelGlass>
          <TaskImage imageKey={task.imageKey} alt={task.title} />
        </PanelGlass>
      )}

      {taskState.helpCodeUsed && task.hints?.code && (
        <PanelGlass>
          <h3 className="mb-2 font-semibold">Ukázkový kód</h3>
          <pre className="overflow-x-auto rounded bg-black/40 p-3 font-mono text-sm">
            {task.hints.code}
          </pre>
        </PanelGlass>
      )}

      {taskState.helpWiringUsed && task.hints?.wiring && (
        <PanelGlass>
          <h3 className="mb-2 font-semibold">Schéma zapojení</h3>
          <p className="text-sm text-[color:var(--theme-muted)]">
            {task.hints.wiring}
          </p>
        </PanelGlass>
      )}

      <PanelGlass>
        <h3 className="mb-3 font-semibold">Tvůj kód</h3>
        <CodeValidator taskId={task.id} onSuccess={handleSuccess} />
      </PanelGlass>

      <PanelGlass>
        <h3 className="mb-3 font-semibold">Pomocníci</h3>
        <HelpCards taskId={task.id} taskState={taskState} />
      </PanelGlass>
    </motion.div>
  );
}
