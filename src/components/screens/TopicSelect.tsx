"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { TopicButton } from "@/components/ui/TopicButton";
import { useGameState } from "@/components/providers/GameStateProvider";
import { Workspace3D } from "@/components/3d/Workspace3D";
import { TOPIC_OPTIONS } from "@/lib/topics";
import type { TopicId } from "@/types";

interface TopicSelectProps {
  onBackToLanding?: () => void;
}

export function TopicSelect({ onBackToLanding }: TopicSelectProps) {
  const { dispatch } = useGameState();
  const [activeTopic, setActiveTopic] = useState<TopicId | null>(null);
  const [printMode, setPrintMode] = useState<"menu" | "studio">("menu");

  function handleSelect(topicId: string) {
    if (topicId === "3d-print") {
      setActiveTopic("3d-print");
      return;
    }
    dispatch({ type: "SELECT_TOPIC", topicId: topicId as TopicId });
  }

  if (activeTopic === "3d-print") {
    if (printMode === "studio") return <Workspace3D onExit={() => setPrintMode("menu")} />;

    return (
      <motion.section
        className="topic-screen flex min-h-screen items-center justify-center p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <PanelGlass className="topic-panel w-full max-w-3xl">
          <button
            type="button"
            onClick={() => {
              setPrintMode("menu");
              setActiveTopic(null);
            }}
            className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpet
          </button>

          <h1 className="mb-2 text-3xl font-bold">3D tisk</h1>
          <p className="mb-6 text-sm text-[color:var(--theme-muted)]">
            Vyber si, jestli chces projit zaklady, nebo otevrit prostor pro tvorbu.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              className="panel-glass relative min-h-[150px] w-full rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/30 to-amber-700/20 p-6 text-left transition hover:-translate-y-0.5 hover:border-white/30"
            >
              <span className="block text-xs font-semibold uppercase tracking-wider text-white/60">3D tisk</span>
              <span className="mt-1 block text-3xl font-bold text-white">Learn</span>
            </button>

            <button
              type="button"
              onClick={() => setPrintMode("studio")}
              className="panel-glass relative min-h-[150px] w-full rounded-xl border border-sky-400/40 bg-gradient-to-br from-sky-500/30 to-sky-700/20 p-6 text-left transition hover:-translate-y-0.5 hover:border-white/30"
            >
              <span className="block text-xs font-semibold uppercase tracking-wider text-white/60">3D tisk</span>
              <span className="mt-1 block text-3xl font-bold text-white">Studio</span>
            </button>
          </div>
        </PanelGlass>
      </motion.section>
    );
  }

  return (
    <motion.section
      className="topic-screen flex min-h-screen items-center justify-center p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <PanelGlass className="topic-panel w-full max-w-3xl">
        {onBackToLanding && (
          <button
            type="button"
            onClick={onBackToLanding}
            className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět na úvod
          </button>
        )}
        <h1 className="mb-2 text-3xl font-bold">Vyber si část Učebny, do které chceš vstoupit</h1>
        <p className="mb-6 text-sm text-[color:var(--theme-muted)]">
          Některé části Učebny jsou zatím určené pro tábory Weeks. Veřejnou verzi postupně připravujeme.
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
