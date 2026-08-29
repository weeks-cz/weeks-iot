"use client";

import { useEffect, useRef } from "react";

interface Props {
  /** Spustí se, jakmile se přepne na true. */
  active: boolean;
}

/**
 * Oslava po dokončení.
 *
 * ── Proč to tu je ──────────────────────────────────────────────────────────
 * Dítě zrovna dvacet minut skládalo obvod a psalo program. Odměnou byl
 * zelený rámeček s větou „Funguje to". To je oznámení, ne odměna — a
 * rozdíl mezi nimi je přesně to, proč se v Duolingu chce pokračovat.
 *
 * Konfety kreslí canvas, ne DOM: sto poletujících divů překreslí layout
 * stokrát za snímek a na telefonu to znatelně sekne.
 *
 * Kdo si v systému vyžádal omezený pohyb, nedostane nic — a to je v
 * pořádku, hodnota lekce není v konfetách.
 */

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  color: string;
  size: number;
}

/* Barvy z palety, ne náhodné. Ať to vypadá jako součást aplikace. */
const COLORS = ["#f59e0b", "#10b981", "#6366f1", "#ef4444", "#06b6d4"];
const COUNT = 90;
const GRAVITY = 0.22;
const DURATION_MS = 2600;

export function Celebration({ active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    /* Vyletí zezdola ze středu — jako když něco vystřelí, ne jako když
       něco padá. Padání ze stropu působí jako chyba. */
    const pieces: Piece[] = Array.from({ length: COUNT }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 9 + Math.random() * 9;

      return {
        x: width / 2 + (Math.random() - 0.5) * width * 0.35,
        y: height * 0.75,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.28,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        size: 5 + Math.random() * 6,
      };
    });

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);

      /* Ke konci se vytrácí, aby nezmizely skokem. */
      ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION_MS);

      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += GRAVITY;
        p.vx *= 0.99;
        p.rotation += p.spin;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (elapsed < DURATION_MS) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  /* Plátno je v DOM pořád. Prázdné nic nestojí a odpadá tím stav „právě
     je vidět", který by se musel přepínat z efektu. */
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
    />
  );
}
