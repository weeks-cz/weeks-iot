"use client";

import { Button } from "@/components/ui/Button";
import { useGameState } from "@/components/providers/GameStateProvider";
import type { TaskState } from "@/types";

interface Props {
  taskId: string;
  taskState: TaskState;
}

export function HelpCards({ taskId, taskState }: Props) {
  const { state, dispatch } = useGameState();
  const stars = state.account.stars;
  const isAdmin = state.adminPreviewActive;
  const cfg = state.config;

  const codeCost = cfg.helpCodeCost;
  const wiringCost = cfg.helpWiringCost;
  const skipCost = cfg.skipCost;

  function label(cost: number, used: boolean, adminLabel: string) {
    if (isAdmin) return adminLabel;
    if (used) return "Použito";
    return `${cost} ⭐`;
  }

  function title(cost: number, used: boolean) {
    if (used) return "Tuto nápovědu jsi už použil";
    if (!isAdmin && stars < cost) return `Potřebuješ ${cost} ⭐ (máš ${stars})`;
    return undefined;
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <span title={title(codeCost, taskState.helpCodeUsed)}>
        <Button
          variant="secondary"
          className="w-full"
          disabled={taskState.helpCodeUsed || (!isAdmin && stars < codeCost)}
          onClick={() => dispatch({ type: "USE_HELP_CODE", taskId })}
        >
          💡 Ukaž kód ({label(codeCost, taskState.helpCodeUsed, "ADMIN")})
        </Button>
      </span>
      <span title={title(wiringCost, taskState.helpWiringUsed)}>
        <Button
          variant="secondary"
          className="w-full"
          disabled={taskState.helpWiringUsed || (!isAdmin && stars < wiringCost)}
          onClick={() => dispatch({ type: "USE_HELP_WIRING", taskId })}
        >
          🔌 Ukaž zapojení ({label(wiringCost, taskState.helpWiringUsed, "ADMIN")})
        </Button>
      </span>
      <span title={title(skipCost, taskState.skipUsed)}>
        <Button
          variant="secondary"
          className="w-full"
          disabled={taskState.skipUsed || (!isAdmin && stars < skipCost)}
          onClick={() => dispatch({ type: "USE_SKIP", taskId })}
        >
          ⏭ Přeskočit ({label(skipCost, taskState.skipUsed, "ADMIN")})
        </Button>
      </span>
    </div>
  );
}
