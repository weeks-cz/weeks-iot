"use client";
import { PaletteCard } from "./PaletteCard";
import type { ComponentType } from "@/types/cad";

interface Props {
  palette: ComponentType[];
  disabled?: boolean;
}

export function Palette({ palette, disabled }: Props) {
  return (
    <aside className="w-44 shrink-0 overflow-y-auto border-r border-white/10 bg-black/40 p-3">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">
        Komponenty
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {palette.map(t => (
          <PaletteCard key={t} type={t} disabled={disabled} />
        ))}
      </div>
    </aside>
  );
}
