"use client";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/lib/cad/constants";
import type { CADAction } from "./hooks/useCADReducer";

interface Props {
  zoom: number;
  dispatch: React.Dispatch<CADAction>;
}

export function ZoomControls({ zoom, dispatch }: Props) {
  const setZoom = (z: number) => dispatch({
    type: "SET_ZOOM",
    zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(z.toFixed(2)))),
  });
  return (
    <div className="absolute bottom-4 right-4 flex gap-1 rounded-lg border border-white/15 bg-black/70 p-1">
      <button onClick={() => setZoom(zoom - ZOOM_STEP)} className="rounded p-1 hover:bg-white/10" aria-label="Zmenšit">
        <Minus className="h-4 w-4" />
      </button>
      <span className="px-2 py-1 text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom(zoom + ZOOM_STEP)} className="rounded p-1 hover:bg-white/10" aria-label="Zvětšit">
        <Plus className="h-4 w-4" />
      </button>
      <button
        onClick={() => {
          dispatch({ type: "SET_ZOOM", zoom: ZOOM_DEFAULT });
          dispatch({ type: "SET_PAN", pan: { x: 0, y: 0 } });
        }}
        className="rounded p-1 hover:bg-white/10"
        aria-label="Reset zoom"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}
