"use client";

import { motion } from "framer-motion";
import { Lock, Check } from "lucide-react";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { StarBadge } from "@/components/ui/StarBadge";
import { Button } from "@/components/ui/Button";
import { useGameState } from "@/components/providers/GameStateProvider";
import { SECTIONS } from "@/lib/tasks";
import type { Task } from "@/types";

export function TaskList() {
  const { state, dispatch } = useGameState();

  function openTask(t: Task) {
    dispatch({ type: "OPEN_TASK", taskId: t.id });
  }

  function unlockSection(sectionId: "advanced" | "expert") {
    dispatch({ type: "UNLOCK_SECTION", sectionId });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto max-w-5xl p-6 space-y-8"
    >
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Úkoly</h1>
        <StarBadge count={state.account.stars} />
      </header>

      {SECTIONS.map((section) => {
        const unlocked = state.sections[section.id]?.unlocked ?? false;
        return (
          <section key={section.id}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{section.label}</h2>
              {!unlocked && section.unlockCost !== undefined && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    unlockSection(section.id as "advanced" | "expert")
                  }
                  disabled={state.account.stars < section.unlockCost}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Odemknout za {section.unlockCost} ⭐
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.tasks.map((t) => {
                const ts = state.tasks[t.id];
                const done = ts?.status === "completed";
                return (
                  <PanelGlass
                    key={t.id}
                    className={`cursor-pointer transition-transform hover:scale-[1.02] ${
                      !unlocked ? "pointer-events-none opacity-40" : ""
                    }`}
                    onClick={() => unlocked && openTask(t)}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{t.title}</h3>
                      {done && (
                        <Check className="h-5 w-5 text-[color:var(--theme-success)]" />
                      )}
                    </div>
                    <p className="text-sm text-[color:var(--theme-muted)] line-clamp-2">
                      {t.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <StarBadge count={t.reward} />
                    </div>
                  </PanelGlass>
                );
              })}
            </div>
          </section>
        );
      })}
    </motion.div>
  );
}
