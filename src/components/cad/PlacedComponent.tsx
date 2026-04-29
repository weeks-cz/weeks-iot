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
  readOnly?: boolean;
}

export function PlacedComponent({ comp, selected, dispatch, readOnly }: Props) {
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
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      const newX = dragState.current.originX + dx;
      const newY = dragState.current.originY + dy;
      dispatch({ type: "MOVE_COMPONENT", id: comp.id, x: newX, y: newY });
    };
    const up = (ev: MouseEvent) => {
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
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
  }, [comp, dispatch, readOnly]);

  const onPinClick = useCallback((e: React.MouseEvent, pinName: string) => {
    e.stopPropagation();
    if (readOnly) return;
    const pin: PinRef = { compId: comp.id, pinName };
    dispatch({ type: "BEGIN_WIRE", from: pin });
  }, [comp.id, dispatch, readOnly]);

  const wokwiAttrs = { ...(spec.wokwiAttrs ?? {}) };
  const Wokwi = spec.wokwiTag as keyof JSX.IntrinsicElements;

  return (
    <div
      ref={elRef}
      data-cad-component
      data-comp-id={comp.id}
      className="absolute select-none"
      style={{
        left: comp.x, top: comp.y,
        transform: `scale(${spec.scale})`,
        transformOrigin: "0 0",
        cursor: readOnly ? "default" : "grab",
        outline: selected ? "1px solid #fbbf24" : undefined,
        outlineOffset: 4,
      }}
      onMouseDown={onMouseDown}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Wokwi {...(wokwiAttrs as any)} />

      <div className="pointer-events-none absolute inset-0">
        {spec.pins.map(pin => (
          <button
            key={pin.name}
            type="button"
            data-pin-name={pin.name}
            onClick={(e) => onPinClick(e, pin.name)}
            className="pointer-events-auto absolute rounded-full hover:bg-amber-300/60 focus:bg-amber-300/80"
            style={{
              left: pin.dx * PITCH / spec.scale - PIN_HIT_AREA / 2,
              top:  pin.dy * PITCH / spec.scale - PIN_HIT_AREA / 2,
              width: PIN_HIT_AREA,
              height: PIN_HIT_AREA,
            }}
            aria-label={`Pin ${pin.name}`}
          />
        ))}
      </div>
    </div>
  );
}
