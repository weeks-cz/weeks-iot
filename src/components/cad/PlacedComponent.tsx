"use client";
import { useCallback, useRef } from "react";
import { getComponentSpec } from "@/lib/cad/components";
import { PIN_HIT_AREA, PITCH } from "@/lib/cad/constants";
import { snapToGrid } from "@/lib/cad/circuit";
import type { CircuitComponent, PinRef } from "@/types/cad";
import type { CADAction } from "./hooks/useCADReducer";

interface Props {
  comp: CircuitComponent;
  selected: boolean;
  dispatch: React.Dispatch<CADAction>;
  wireInProgress: PinRef | null;
  onPinAction: (pin: PinRef) => void;
  readOnly?: boolean;
  zoom?: number;
}

export function PlacedComponent({ comp, selected, dispatch, wireInProgress, onPinAction, readOnly, zoom = 1 }: Props) {
  const spec = getComponentSpec(comp.type);
  const elRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    dispatch({ type: "SELECT", target: { kind: "component", id: comp.id } });
    dragState.current = {
      active: true,
      startX: e.clientX, startY: e.clientY,
      originX: comp.x, originY: comp.y,
    };

    const move = (ev: MouseEvent) => {
      if (!dragState.current.active) return;
      const dx = (ev.clientX - dragState.current.startX) / zoom;
      const dy = (ev.clientY - dragState.current.startY) / zoom;
      dispatch({ type: "MOVE_COMPONENT", id: comp.id, x: dragState.current.originX + dx, y: dragState.current.originY + dy });
    };
    const up = (ev: MouseEvent) => {
      const dx = (ev.clientX - dragState.current.startX) / zoom;
      const dy = (ev.clientY - dragState.current.startY) / zoom;
      dispatch({
        type: "MOVE_COMPONENT", id: comp.id,
        x: snapToGrid(dragState.current.originX + dx),
        y: snapToGrid(dragState.current.originY + dy),
      });
      dragState.current.active = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [comp, dispatch, readOnly, zoom]);

  const onPinClick = useCallback((e: React.MouseEvent, pinName: string) => {
    e.stopPropagation();
    if (readOnly) return;
    onPinAction({ compId: comp.id, pinName });
  }, [comp.id, onPinAction, readOnly]);

  const wokwiAttrs = { ...(spec.wokwiAttrs ?? {}) };
  const Wokwi = spec.wokwiTag as keyof JSX.IntrinsicElements;

  // Show pin markers when hovering (group-hover), wire is in progress, or component is selected.
  // wireInProgress/selected drive inline opacity:1 which overrides the opacity-0 Tailwind class.
  const pinAlwaysVisible = !!wireInProgress || selected;

  return (
    <div
      ref={elRef}
      data-cad-component
      data-comp-id={comp.id}
      className="group absolute select-none"
      style={{
        left: comp.x, top: comp.y,
        transform: `scale(${spec.scale})`,
        transformOrigin: "0 0",
        cursor: readOnly ? "default" : "grab",
        outline: selected ? "2px solid #fbbf24" : undefined,
        outlineOffset: 4,
      }}
      onMouseDown={onMouseDown}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Wokwi {...(wokwiAttrs as any)} />

      <div className="pointer-events-none absolute inset-0">
        {spec.pins.map(pin => {
          const isWireStart = wireInProgress?.compId === comp.id && wireInProgress?.pinName === pin.name;
          return (
            <button
              key={pin.name}
              type="button"
              data-pin-name={pin.name}
              onClick={(e) => onPinClick(e, pin.name)}
              onMouseDown={(e) => e.stopPropagation()}
              className="pointer-events-auto absolute flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                left: pin.dx * PITCH / spec.scale - PIN_HIT_AREA / 2,
                top:  pin.dy * PITCH / spec.scale - PIN_HIT_AREA / 2,
                width: PIN_HIT_AREA,
                height: PIN_HIT_AREA,
                opacity: pinAlwaysVisible ? 1 : undefined,
                cursor: wireInProgress ? "crosshair" : "pointer",
              }}
              aria-label={`Pin ${pin.name}`}
            >
              <span
                className={`block rounded-full transition-all duration-75 ${
                  isWireStart
                    ? "h-3 w-3 bg-blue-400 ring-1 ring-white"
                    : "h-2 w-2 bg-amber-400 ring-1 ring-amber-200/60 hover:h-2.5 hover:w-2.5 hover:bg-amber-300"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
