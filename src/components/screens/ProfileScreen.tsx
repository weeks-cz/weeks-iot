"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Cpu, Palette, Sparkles } from "lucide-react";
import Image from "next/image";

import { useGameState } from "@/components/providers/GameStateProvider";
import { Button } from "@/components/ui/Button";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { StarBadge } from "@/components/ui/StarBadge";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LEVEL_BADGES } from "@/lib/rewards";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { SECTIONS, getAllTasks } from "@/lib/tasks";
import type { ScreenState } from "@/types";

/**
 * Profil dítěte — přehled postupu: avatar, hvězdy, úroveň, splněné úkoly
 * a uložené obvody ("projekty"). Čistě prezentační nad GameState, žádná
 * nová persistence. [L] task z epiku "IoT · Účty, profil & cloud sync".
 */
export function ProfileScreen() {
  const { state, dispatch } = useGameState();
  const { account } = state;

  const go = (screen: ScreenState["currentScreen"]) =>
    dispatch({ type: "SET_SCREEN", screen: { currentScreen: screen, pinLevel: state.screen.pinLevel } });

  const avatar = AVATAR_OPTIONS.find((a) => a.id === account.avatarId) ?? AVATAR_OPTIONS[0]!;

  const allTasks = getAllTasks();
  const completedTasks = allTasks.filter((t) => state.tasks[t.id]?.status === "completed");
  const totalCount = allTasks.length;
  const completedCount = completedTasks.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const achievedBadges = LEVEL_BADGES.filter((b) => account.stars >= (b.minStars ?? 0));
  const currentBadge = achievedBadges[achievedBadges.length - 1] ?? LEVEL_BADGES[0];
  const nextBadge = LEVEL_BADGES.find((b) => account.stars < (b.minStars ?? 0));
  const starsToNext = nextBadge ? (nextBadge.minStars ?? 0) - account.stars : 0;

  const sectionLabel = new Map(SECTIONS.map((s) => [s.id, s.label]));

  const headline = state.currentStudentNumber
    ? `Student ${state.currentStudentNumber}`
    : account.nickname ?? "Můj profil";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto max-w-3xl px-4 py-6 space-y-5"
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="md" onClick={() => go("task-list")}>
          <ArrowLeft className="mr-2 h-5 w-5" />
          Zpět
        </Button>
        <h1 className="text-lg font-bold">Můj profil</h1>
      </header>

      {/* Hero */}
      <PanelGlass>
        <div className="flex items-center gap-4">
          <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-black/20 ring-2 ring-[color:var(--theme-accent)]/40">
            <Image
              src={`/avatars/${avatar.filename}`}
              alt={avatar.label}
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-black">{headline}</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-[color:var(--theme-muted)]">
              <span className="text-lg">{currentBadge?.icon}</span>
              <span className="font-semibold uppercase tracking-wide">{currentBadge?.label}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StarBadge count={account.stars} />
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--theme-panel)] px-3 py-1 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-[color:var(--theme-accent)]" />
                {account.tokens} tokenů
              </span>
            </div>
          </div>
        </div>
      </PanelGlass>

      {/* Postup */}
      <PanelGlass>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-semibold text-base">Postup</h3>
          <span className="text-sm text-[color:var(--theme-muted)]">
            {completedCount} z {totalCount} úkolů · {pct} %
          </span>
        </div>
        <ProgressBar value={completedCount} max={totalCount} />
      </PanelGlass>

      {/* Odznaky */}
      <PanelGlass>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-base">Odznaky</h3>
          <button
            type="button"
            onClick={() => go("level-badges")}
            className="text-sm text-[color:var(--theme-accent)] hover:underline"
          >
            Detail
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {LEVEL_BADGES.map((badge) => (
            <LevelBadge key={badge.id} badge={badge} achieved={account.stars >= (badge.minStars ?? 0)} />
          ))}
        </div>
        {nextBadge && (
          <p className="mt-4 text-center text-sm text-[color:var(--theme-muted)]">
            Do odznaku <span className="font-semibold">{nextBadge.label}</span> ti zbývá{" "}
            <span className="font-bold text-[color:var(--theme-star)]">{starsToNext} ★</span>
          </p>
        )}
      </PanelGlass>

      {/* Projekty (splněné úkoly + uložené obvody) */}
      <PanelGlass>
        <div className="mb-4 flex items-center gap-2">
          <Cpu className="h-5 w-5 text-[color:var(--theme-accent)]" />
          <h3 className="font-semibold text-base">Moje projekty</h3>
        </div>
        {completedTasks.length === 0 ? (
          <p className="text-sm text-[color:var(--theme-muted)]">
            Zatím tu nic není. Splň první úkol a objeví se tu tvůj první projekt!
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {completedTasks.map((task) => {
              const hasCircuit = (state.circuits[task.id]?.comps?.length ?? 0) > 0;
              return (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{task.title}</p>
                    <p className="text-xs text-[color:var(--theme-muted)]">
                      {sectionLabel.get(task.sectionId) ?? task.sectionId}
                    </p>
                  </div>
                  {hasCircuit && (
                    <span className="shrink-0 rounded-full bg-[color:var(--theme-accent)]/15 px-2 py-0.5 text-[10px] font-bold text-[color:var(--theme-accent)]">
                      obvod
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PanelGlass>

      {/* Akce */}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="md" onClick={() => go("avatar-shop")}>
          <Sparkles className="mr-2 h-4 w-4" />
          Změnit avatara
        </Button>
        <Button variant="secondary" size="md" onClick={() => go("style-shop")}>
          <Palette className="mr-2 h-4 w-4" />
          Změnit styl
        </Button>
      </div>
    </motion.div>
  );
}
