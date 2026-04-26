"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Lock, Smile, Star } from "lucide-react";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { StarBadge } from "@/components/ui/StarBadge";
import { Button } from "@/components/ui/Button";
import { useGameState } from "@/components/providers/GameStateProvider";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { AVATAR_SHOP_CONFIG } from "@/lib/config";

export function AvatarShop() {
  const { state, dispatch } = useGameState();
  const cost = AVATAR_SHOP_CONFIG.directUnlockCost;

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
      className="mx-auto max-w-6xl p-6 space-y-6"
    >
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zpět
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Smile className="h-6 w-6" />
          Obchod s avatary
        </h1>
        <StarBadge count={state.account.stars} />
      </header>

      <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
        {AVATAR_OPTIONS.map((opt) => {
          const isUnlocked = state.account.unlockedAvatars.includes(opt.id);
          const isActive = state.account.avatarId === opt.id;
          const canAfford = state.account.stars >= cost;

          const onClick = () => {
            if (isActive) return;
            if (isUnlocked) {
              dispatch({ type: "SET_AVATAR", avatarId: opt.id });
            } else if (canAfford) {
              dispatch({ type: "PURCHASE_AVATAR", avatarId: opt.id });
            }
          };

          const interactive = !isActive && (isUnlocked || canAfford);

          return (
            <PanelGlass
              key={opt.id}
              className={`!p-3 space-y-2 text-center transition-transform ${
                interactive ? "cursor-pointer hover:scale-[1.03]" : ""
              } ${isActive ? "ring-2 ring-[color:var(--theme-accent)]" : ""}`}
              onClick={interactive ? onClick : undefined}
            >
              <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-md bg-black/20">
                <Image
                  src={`/avatars/${opt.filename}`}
                  alt={opt.label}
                  width={128}
                  height={128}
                  className={`h-full w-full object-cover ${
                    !isUnlocked ? "opacity-40 grayscale" : ""
                  }`}
                />
                {isActive && (
                  <span className="absolute right-1 top-1 rounded-full bg-[color:var(--theme-success)] p-1 text-[#0d1427]">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                {!isUnlocked && (
                  <span className="absolute inset-x-1 bottom-1 inline-flex items-center justify-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Lock className="h-3 w-3" />
                    {cost}
                    <Star className="h-3 w-3 fill-[color:var(--theme-star)] text-[color:var(--theme-star)]" />
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-[color:var(--theme-text)]">
                {opt.label}
              </div>
              {isActive && (
                <div className="text-[10px] font-bold uppercase text-[color:var(--theme-success)]">
                  Aktivní
                </div>
              )}
            </PanelGlass>
          );
        })}
      </div>
    </motion.div>
  );
}
