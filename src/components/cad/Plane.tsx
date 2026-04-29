"use client";
import { forwardRef } from "react";
import { PlacedComponent } from "./PlacedComponent";
import { usePanZoom } from "./hooks/usePanZoom";
import { usePlaneDropTarget } from "./hooks/useDragDrop";
import { GRID_DOT_OPACITY, GRID_DOT_SIZE, PITCH } from "@/lib/cad/constants";
import type { CADAction, CADState } from "./hooks/useCADReducer";

interface Props {
  state: CADState;
  dispatch: React.Dispatch<CADAction>;
  readOnly?: boolean;
}

export const Plane = forwardRef<HTMLDivElement, Props>(function Plane(
  { state, dispatch, readOnly },
  ref,
) {
  const containerRef = (ref as React.RefObject<HTMLDivElement>) ?? null;
  const panZoom = usePanZoom(containerRef, state, dispatch);
  const innerRef = ref as React.RefObject<HTMLDivElement>;
  const dropProps = usePlaneDropTarget(innerRef, dispatch);

  const transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-neutral-950 cursor-default"
      onMouseDown={panZoom.onMouseDown}
      onMouseMove={panZoom.onMouseMove}
      onMouseUp={panZoom.onMouseUp}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          dispatch({ type: "SELECT", target: null });
        }
      }}
    >
      <div
        ref={ref}
        id="workspace-plane"
        className="absolute"
        onDragOver={dropProps.onDragOver}
        onDrop={dropProps.onDrop}
        style={{
          width: 4000, height: 4000,
          left: 2000, top: 2000,
          transform,
          transformOrigin: "0 0",
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,${GRID_DOT_OPACITY}) ${GRID_DOT_SIZE}px, transparent ${GRID_DOT_SIZE}px)`,
          backgroundSize: `${PITCH}px ${PITCH}px`,
        }}
      >
        {state.circuit.comps.map(comp => (
          <PlacedComponent
            key={comp.id}
            comp={comp}
            selected={state.selection?.kind === "component" && state.selection.id === comp.id}
            dispatch={dispatch}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
});
