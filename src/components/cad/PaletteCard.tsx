"use client";
import Image from "next/image";
import { getComponentSpec } from "@/lib/cad/components";
import { usePaletteDragSource } from "./hooks/useDragDrop";
import type { ComponentType } from "@/types/cad";

export function PaletteCard({ type, disabled }: { type: ComponentType; disabled?: boolean }) {
  const spec = getComponentSpec(type);
  const { onDragStart } = usePaletteDragSource();
  return (
    <div
      draggable={!disabled}
      onDragStart={(e) => !disabled && onDragStart(e, type)}
      className={`flex flex-col items-center gap-2 rounded-lg border border-white/15 bg-white/5 p-3 hover:border-white/30 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-grab"
      }`}
      title={spec.label}
    >
      <Image src={spec.paletteIcon} alt={spec.label} width={64} height={64} />
      <span className="text-center text-xs text-white/80">{spec.label}</span>
    </div>
  );
}
