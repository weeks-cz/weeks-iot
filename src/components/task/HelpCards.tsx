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

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Button
        variant="secondary"
        disabled={taskState.helpCodeUsed || stars < DEFAULT_CONFIG.helpCodeCost}
        onClick={() => dispatch({ type: "USE_HELP_CODE", taskId })}
      >
        💡 Ukaž kód ({DEFAULT_CONFIG.helpCodeCost} ⭐)
      </Button>
      <Button
        variant="secondary"
        disabled={taskState.helpWiringUsed || stars < DEFAULT_CONFIG.helpWiringCost}
        onClick={() => dispatch({ type: "USE_HELP_WIRING", taskId })}
      >
        🔌 Ukaž zapojení ({DEFAULT_CONFIG.helpWiringCost} ⭐)
      </Button>
      <Button
        variant="secondary"
        disabled={taskState.skipUsed || stars < DEFAULT_CONFIG.skipCost}
        onClick={() => dispatch({ type: "USE_SKIP", taskId })}
      >
        ⏭ Přeskočit ({DEFAULT_CONFIG.skipCost} ⭐)
      </Button>
    </div>
  );
}
