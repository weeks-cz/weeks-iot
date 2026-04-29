"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";

const CADModal = dynamic(() => import("@/components/cad/CADModal"), { ssr: false });
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

  const [cadOpen, setCadOpen] = useState(false);

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
      className="mx-auto max-w-3xl p-6 space-y-6"
    >
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zpět
        </Button>
        <div className="flex items-center gap-2">
          {prevTaskId && (
            <button
              type="button"
              onClick={() => dispatch({ type: "OPEN_TASK", taskId: prevTaskId })}
              className="text-xs text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)] border border-white/10 rounded px-2 py-1"
            >
              ← Předchozí
            </button>
          )}
          {nextTaskId && (
            <button
              type="button"
              onClick={() => dispatch({ type: "OPEN_TASK", taskId: nextTaskId })}
              className="text-xs text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)] border border-white/10 rounded px-2 py-1"
            >
              Další →
            </button>
          )}
        </div>
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

      {task.cad && (
        <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3">
          <button
            type="button"
            onClick={() => setCadOpen(true)}
            className="flex items-center gap-2 rounded-md bg-[color:var(--theme-accent)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
          >
            <span>▶</span> Postavit obvod
          </button>
          <p className="mt-2 text-xs text-white/60">
            Otevře vizuální editor obvodu. Tvůj postup se uloží automaticky.
          </p>
        </div>
      )}

      {/* Daily challenge note */}
      {isDaily && (
        <PanelGlass className="flex items-center justify-between gap-4 border-amber-400/30 bg-amber-400/5">
          <div>
            <strong className="block text-sm text-amber-300">
              {dailyClaimed ? "Denní výzva dnes splněna ✓" : `Dnešní denní výzva — +${REWARD_CONFIG.dailyChallengeStars} hvězdiček`}
            </strong>
            <p className="text-xs text-[color:var(--theme-muted)]">
              {dailyClaimed
                ? "Zítra se objeví nová denní výzva."
                : "Odevzdej funkční kód a získej bonusové hvězdičky."}
            </p>
          </div>
          {!dailyClaimed && (
            <Button variant="secondary" size="sm" onClick={handleDailyChallenge}>
              Odevzdat výzvu
            </Button>
          )}
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

      <CADModal taskId={task.id} open={cadOpen} onClose={() => setCadOpen(false)} />
    </motion.div>
  );
}
