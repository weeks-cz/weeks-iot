"use client";

import { motion } from "framer-motion";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { TopicButton } from "@/components/ui/TopicButton";
import { useGameState } from "@/components/providers/GameStateProvider";
import { TOPIC_OPTIONS } from "@/lib/topics";
import type { TopicId } from "@/types";

export function TopicSelect() {
  const { dispatch } = useGameState();

  function handleSelect(topicId: string) {
    dispatch({ type: "SELECT_TOPIC", topicId: topicId as TopicId });
  }

  return (
    <motion.section
      className="topic-screen flex min-h-screen items-center justify-center p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <PanelGlass className="topic-panel w-full max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold">Vyber si téma tábora</h1>
        <p className="mb-6 text-sm text-[color:var(--theme-muted)]">
          Aktuálně je dostupný pouze IoT a elektronika. Další témata připravujeme — můžeš se podívat, co se chystá.
        </p>
        <div className="topic-grid grid gap-4 sm:grid-cols-2">
          {TOPIC_OPTIONS.map((topic) => (
            <TopicButton
              key={topic.id}
              topicId={topic.id}
              label={topic.label}
              accent={topic.accent}
              enabled={topic.enabled}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </PanelGlass>
    </motion.section>
  );
}
