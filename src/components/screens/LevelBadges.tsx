"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { StarBadge } from "@/components/ui/StarBadge";
import { Button } from "@/components/ui/Button";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useGameState } from "@/components/providers/GameStateProvider";
import { LEVEL_BADGES } from "@/lib/rewards";

export function LevelBadges() {
  const { state, dispatch } = useGameState();
  const stars = state.account.stars;

  function goBack() {
    dispatch({
      type: "SET_SCREEN",
      screen: { currentScreen: "task-list", pinLevel: state.screen.pinLevel },
    });
  }

  // Find current and next badge
  const achievedBadges = LEVEL_BADGES.filter((b) => stars >= (b.minStars ?? 0));
  const currentBadge = achievedBadges[achievedBadges.length - 1] ?? LEVEL_BADGES[0];
  const nextBadge = LEVEL_BADGES.find((b) => stars < (b.minStars ?? 0));

  const currentMin = currentBadge?.minStars ?? 0;
  const nextMin = nextBadge?.minStars ?? currentMin;
  const progressValue = nextBadge ? stars - currentMin : 1;
  const progressMax = nextBadge ? Math.max(1, nextMin - currentMin) : 1;
  const remaining = nextBadge ? Math.max(0, nextMin - stars) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto max-w-3xl px-4 py-6 space-y-6"
    >
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="md" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zpět
        </Button>
        <h1 className="text-2xl font-bold">Odznaky úrovní</h1>
        <StarBadge count={stars} />
      </header>

      <PanelGlass className="space-y-6">
        <div className="flex flex-wrap items-end justify-center gap-6 sm:gap-10">
          {LEVEL_BADGES.map((badge) => (
            <LevelBadge
              key={badge.id}
              badge={badge}
              achieved={stars >= (badge.minStars ?? 0)}
            />
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[color:var(--theme-muted)]">
            <span>
              Aktuální úroveň:{" "}
              <strong className="text-[color:var(--theme-text)]">
                {currentBadge?.label ?? "—"}
              </strong>
            </span>
            {nextBadge ? (
              <span>
                Do <strong>{nextBadge.label}</strong> chybí{" "}
                <strong className="text-[color:var(--theme-text)]">{remaining} ⭐</strong>
              </span>
            ) : (
              <span className="font-semibold text-[color:var(--theme-success)]">
                Maximální úroveň dosažena!
              </span>
            )}
          </div>
          <ProgressBar value={progressValue} max={progressMax} />
        </div>

        <p className="text-center text-sm text-[color:var(--theme-muted)]">
          Sbírej hvězdičky a získávej odznaky.
        </p>
      </PanelGlass>
    </motion.div>
  );
}
