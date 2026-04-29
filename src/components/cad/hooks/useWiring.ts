import { useCallback } from "react";
import type { PinRef } from "@/types/cad";
import type { CADAction } from "./useCADReducer";

export function useWiring(dispatch: React.Dispatch<CADAction>) {
  const onPinClick = useCallback((pin: PinRef, inProgressFrom: PinRef | null) => {
    if (!inProgressFrom) {
      dispatch({ type: "BEGIN_WIRE", from: pin });
      return;
    }
    if (inProgressFrom.compId === pin.compId && inProgressFrom.pinName === pin.pinName) {
      dispatch({ type: "CANCEL_WIRE" });
      return;
    }
    dispatch({ type: "FINISH_WIRE", to: pin });
  }, [dispatch]);

  return { onPinClick };
}
