"use client";

import { useEffect, useRef, useState } from "react";
import { CircuitBuilder } from "@/features/circuit/components/CircuitBuilder";
import { useWokwiElements } from "@/features/circuit/components/useWokwiElements";
import type { Circuit } from "@/features/circuit/types";
import type { SimulationFrame } from "@/features/circuit/simulate";

interface Props {
  circuit: Circuit;
  /** Popisek pro čtečku — obrázek sám je před ní schovaný. */
  label: string;
  height?: number;
  /** Snímek, ze kterého se rozsvítí LED. Počítat ho tu by chtělo zdrojový
      kód programu, který náhled nedostává — dodá ho volající, má-li ho. */
  frame?: SimulationFrame | null;
}

const NOOP = () => {};

/**
 * Tmavý box, ve kterém náhled stojí — před vykreslením i po něm je to
 * tentýž element, takže se stránka při načtení obvodu nepohne.
 */
export function ThumbPlaceholder({
  label,
  height,
  boxRef,
  children,
}: {
  label: string;
  height: number;
  boxRef?: React.Ref<HTMLDivElement>;
  children?: React.ReactNode;
}) {
  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={label}
      className="relative w-full overflow-hidden rounded-lg bg-ink"
      style={{ height }}
    >
      {children}
    </div>
  );
}

/** Samotné kreslení. Součástkové prvky se začnou stahovat až tady, tedy
    teprve když je náhled v zorném poli. */
function ThumbDrawing({ circuit, frame, height }: Pick<Props, "circuit" | "frame"> & { height: number }) {
  const elementsReady = useWokwiElements();
  if (!elementsReady) return null;
  return (
    /* Žádný dotek ani kolečko: náhled je obrázek, ne plocha. */
    <div aria-hidden="true" className="pointer-events-none select-none">
      <CircuitBuilder
        palette={[]}
        initialCircuit={circuit}
        onChange={NOOP}
        frame={frame}
        readOnly
        bare
        height={height}
      />
    </div>
  );
}

/**
 * Malý náhled obvodu, který dítě postavilo — jen ke koukání.
 *
 * Kreslí se stejným `CircuitBuilder` jako v lekci, ale až ve chvíli, kdy je
 * box v zorném poli a jsou načtené součástkové prvky. Na stránce s víc
 * náhledy se tak nic nekreslí předem a nic se nekreslí dvakrát.
 */
export function CircuitThumb({ circuit, label, height = 160, frame }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <ThumbPlaceholder label={label} height={height} boxRef={boxRef}>
      {visible && <ThumbDrawing circuit={circuit} frame={frame} height={height} />}
    </ThumbPlaceholder>
  );
}
