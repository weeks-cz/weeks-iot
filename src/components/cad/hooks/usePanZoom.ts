import { useCallback, useEffect, useRef } from "react";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/lib/cad/constants";
import type { CADAction, CADState } from "./useCADReducer";

export function usePanZoom(
  containerRef: React.RefObject<HTMLElement>,
  state: CADState,
  dispatch: React.Dispatch<CADAction>,
) {
  const panActive = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, state.zoom + dir * ZOOM_STEP));
      dispatch({ type: "SET_ZOOM", zoom: Number(next.toFixed(2)) });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [containerRef, state.zoom, dispatch]);

  // Middle-click drag pan
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1) return;
    e.preventDefault();
    panActive.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, panX: state.pan.x, panY: state.pan.y };
  }, [state.pan]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panActive.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    dispatch({ type: "SET_PAN", pan: {
      x: panStart.current.panX + dx,
      y: panStart.current.panY + dy,
    } });
  }, [dispatch]);

  const onMouseUp = useCallback(() => {
    panActive.current = false;
  }, []);

  return { onMouseDown, onMouseMove, onMouseUp };
}
