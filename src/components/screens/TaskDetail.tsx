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
import { findTask, isDailyChallengeTask, hasClaimedDailyChallengeToday, getAdjacentTaskId } from "@/lib/tasks";
import { REWARD_CONFIG } from "@/lib/rewards";

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

  const isDaily = isDailyChallengeTask(taskId);
  const dailyClaimed = hasClaimedDailyChallengeToday(state.account);
  const prevTaskId = getAdjacentTaskId(taskId, "prev");
  const nextTaskId = getAdjacentTaskId(taskId, "next");

  const completeId = taskId;
  const reward = task.reward;
  function handleSuccess() {
    dispatch({ type: "COMPLETE_TASK", taskId: completeId, reward });
  }

  function handleDailyChallenge() {
    if (isDaily && !dailyClaimed) {
      dispatch({ type: "AWARD_DAILY_CHALLENGE" });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto max-w-3xl px-4 py-6 space-y-5"
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="md" onClick={goBack}>
          <ArrowLeft className="mr-2 h-5 w-5" />
          Zpět
        </Button>
        <StarBadge count={task.reward} />
      </header>

      {/* Title + description */}
      <PanelGlass>
        <h1 className="text-2xl font-bold mb-3">{task.title}</h1>
        {isDaily && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-sm font-bold text-amber-300 mb-3">
            ⚡ Denní výzva {dailyClaimed ? "— splněna ✓" : `— +${REWARD_CONFIG.dailyChallengeStars} ★`}
          </span>
        )}
        <p className="whitespace-pre-line text-[color:var(--theme-muted)] leading-relaxed">
          {task.description}
        </p>
      </PanelGlass>

      {/* Image */}
      {task.imageKey && (
        <PanelGlass className="!p-0 overflow-hidden rounded-2xl">
          <TaskImage imageKey={task.imageKey} alt={task.title} />
        </PanelGlass>
      )}

      {/* Help: code */}
      {taskState.helpCodeUsed && task.hints?.code && (
        <PanelGlass>
          <h3 className="mb-3 font-semibold text-base">Ukázkový kód</h3>
          <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 font-mono text-sm">
            {task.hints.code}
          </pre>
        </PanelGlass>
      )}

      {/* Help: wiring */}
      {taskState.helpWiringUsed && task.hints?.wiring && (
        <PanelGlass>
          <h3 className="mb-3 font-semibold text-base">Schéma zapojení</h3>
          <p className="text-sm text-[color:var(--theme-muted)] leading-relaxed">
            {task.hints.wiring}
          </p>
        </PanelGlass>
      )}

      {/* Code validator */}
      <PanelGlass>
        <h3 className="mb-4 font-semibold text-base">Tvůj kód</h3>
        <CodeValidator taskId={task.id} onSuccess={handleSuccess} />
      </PanelGlass>

      {/* Help cards */}
      <PanelGlass>
        <h3 className="mb-4 font-semibold text-base">Pomocníci</h3>
        <HelpCards taskId={task.id} taskState={taskState} />
      </PanelGlass>

      {/* Prev / Next navigation */}
      {(prevTaskId || nextTaskId) && (
        <div className="flex gap-3 pt-2">
          {prevTaskId ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "OPEN_TASK", taskId: prevTaskId })}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-4 text-sm font-semibold text-[color:var(--theme-muted)] hover:border-white/20 hover:text-[color:var(--theme-text)] transition-colors"
            >
              ← Předchozí
            </button>
          ) : <div className="flex-1" />}
          {nextTaskId && (
            <button
              type="button"
              onClick={() => dispatch({ type: "OPEN_TASK", taskId: nextTaskId })}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-4 text-sm font-semibold text-[color:var(--theme-muted)] hover:border-white/20 hover:text-[color:var(--theme-text)] transition-colors"
            >
              Další →
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
