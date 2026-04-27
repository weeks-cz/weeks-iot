"use client";

import { Button } from "@/components/ui/Button";
import { DEFAULT_CONFIG } from "@/lib/config";
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

  const codeCost = isAdmin ? 0 : DEFAULT_CONFIG.helpCodeCost;
  const wiringCost = isAdmin ? 0 : DEFAULT_CONFIG.helpWiringCost;
  const skipCost = isAdmin ? 0 : DEFAULT_CONFIG.skipCost;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Button
        variant="secondary"
        disabled={taskState.helpCodeUsed || (!isAdmin && stars < DEFAULT_CONFIG.helpCodeCost)}
        onClick={() => dispatch({ type: "USE_HELP_CODE", taskId })}
      >
        💡 Ukaž kód ({isAdmin ? "ADMIN" : `${codeCost} ⭐`})
      </Button>
      <Button
        variant="secondary"
        disabled={taskState.helpWiringUsed || (!isAdmin && stars < DEFAULT_CONFIG.helpWiringCost)}
        onClick={() => dispatch({ type: "USE_HELP_WIRING", taskId })}
      >
        🔌 Ukaž zapojení ({isAdmin ? "ADMIN" : `${wiringCost} ⭐`})
      </Button>
      <Button
        variant="secondary"
        disabled={taskState.skipUsed || (!isAdmin && stars < DEFAULT_CONFIG.skipCost)}
        onClick={() => dispatch({ type: "USE_SKIP", taskId })}
      >
        ⏭ Přeskočit ({isAdmin ? "ADMIN" : `${skipCost} ⭐`})
      </Button>
    </div>
  );
}
