"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Check, Palette } from "lucide-react";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { StarBadge } from "@/components/ui/StarBadge";
import { Button } from "@/components/ui/Button";
import { useGameState } from "@/components/providers/GameStateProvider";
import { STYLE_OPTIONS } from "@/lib/themes";
import { STYLE_SHOP_CONFIG } from "@/lib/config";

export function StyleShop() {
  const { state, dispatch } = useGameState();
  const cost = STYLE_SHOP_CONFIG.directUnlockCost;

  function goBack() {
    dispatch({
      type: "SET_SCREEN",
      screen: { currentScreen: "task-list", pinLevel: state.screen.pinLevel },
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl p-6 space-y-6"
    >
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zpět
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Palette className="h-6 w-6" />
          Obchod se styly
        </h1>
        <StarBadge count={state.account.stars} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STYLE_OPTIONS.map((opt) => {
          const isUnlocked = state.account.unlockedThemes.includes(opt.id);
          const isActive = state.account.currentTheme === opt.id;
          const canAfford = state.account.stars >= cost;

          return (
            <PanelGlass key={opt.id} data-theme={opt.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-[color:var(--theme-text)]">
                  {opt.label}
                </h3>
                {isActive && (
                  <Check className="h-5 w-5 text-[color:var(--theme-success)]" />
                )}
              </div>
              <p className="text-xs text-[color:var(--theme-muted)] line-clamp-2">
                {opt.description}
              </p>

              {/* Mini live preview */}
              <div className="rounded-md bg-[color:var(--theme-panel)] p-3 space-y-2 border border-white/5">
                <div className="text-xs font-bold text-[color:var(--theme-text)]">
                  Náhled
                </div>
                <span className="inline-block rounded-full bg-[color:var(--theme-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--theme-accent)]">
                  ⭐ Ukázka
                </span>
                <div className="h-7 rounded-md bg-[color:var(--theme-accent)]" />
              </div>

              <div className="flex items-center justify-between pt-1">
                {isActive ? (
                  <span className="text-xs font-semibold text-[color:var(--theme-success)]">
                    Aktivní
                  </span>
                ) : isUnlocked ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      dispatch({ type: "SET_THEME", themeId: opt.id })
                    }
                  >
                    Použít
                  </Button>
                ) : canAfford ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      dispatch({ type: "PURCHASE_THEME", themeId: opt.id })
                    }
                  >
                    Odemknout ({cost} ⭐)
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled>
                    Chybí hvězdičky ({cost} ⭐)
                  </Button>
                )}
              </div>
            </PanelGlass>
          );
        })}
      </div>
    </motion.div>
  );
}
