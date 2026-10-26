"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Certifikát ve 3D (návrh §6.3): přílet, náklon za myší s odleskem,
 * na dotykovém zařízení pomalé pohupování.
 *
 * Všechno jede v jedné smyčce `requestAnimationFrame` a píše se rovnou do
 * `style` — React se při pohybu nepřekresluje. Ukazatel jen nastaví cíl;
 * poloha se k němu každý snímek přiblíží o kus (lerp), takže náklon je
 * plynulý i při trhaném `pointermove`. Když je náklon v klidu, smyčka se
 * zastaví a `will-change` zmizí — prohlížeč nedrží vrstvu zbytečně.
 *
 * Bez JavaScriptu (nebo před hydratací) je certifikát vidět v klidové
 * poloze; výchozí polohu přiletu nastaví až efekt před prvním vykreslením.
 */

interface Pose {
  ty: number;
  rx: number;
  ry: number;
  s: number;
}

const FROM: Pose = { ty: 60, rx: 40, ry: -30, s: 0.7 };
const REST: Pose = { ty: 0, rx: 6, ry: -12, s: 1 };

/** Přílet začne chvíli po nadpisu finále. */
const ARRIVAL_DELAY_MS = 250;
const ARRIVAL_MS = 1100;
/** Stejná křivka jako schválený náhled — mírný přestřel. */
const arrivalEase = cubicBezier(0.2, 1.4, 0.4, 1);

const TILT_X_DEG = 11;
const TILT_Y_DEG = 13;
const TILT_SCALE = 1.03;

const BOB_DEG = 3;
const BOB_PERIOD_MS = 6000;
/** Pohupování se rozjede pozvolna, ne skokem z klidové polohy. */
const BOB_RAMP_MS = 1500;

/** Kus cesty k cíli za snímek při 60 fps; na 120 Hz se přepočítá. */
const LERP = 0.15;
const FRAME_MS = 1000 / 60;
const SETTLED = 0.005;

const DEPTH = {
  "--cert-depth-text": "translateZ(30px)",
  "--cert-depth-seal": "translateZ(50px)",
} as CSSProperties;

export function CertificateStage({ face, onLanded }: { face: ReactNode; onLanded?: () => void }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const glossRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const onLandedRef = useRef(onLanded);

  useLayoutEffect(() => {
    onLandedRef.current = onLanded;
  }, [onLanded]);

  useLayoutEffect(() => {
    const zone = zoneRef.current;
    const card = cardRef.current;
    const sheen = sheenRef.current;
    const gloss = glossRef.current;
    const light = lightRef.current;
    if (!zone || !card || !sheen || !gloss || !light) return;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

    const cur = { ...REST, sheen: 0 };
    const pointer = { x: 0, y: 0, inside: false };
    let mode: "tilt" | "bob" = hoverQuery.matches ? "tilt" : "bob";
    let phase: "arriving" | "live" = "arriving";
    let arrivalStart = 0;
    let bobStart = 0;
    let raf = 0;
    let last = 0;
    let landed = false;
    let active = false;
    /* Mimo obrazovku nebo ve skrytém panelu smyčka stojí — pohupování
       by jinak běželo donekonečna. */
    let onScreen = true;

    function apply(pose: Pose, sheenOpacity: number) {
      card!.style.transform = poseTransform(pose);
      sheen!.style.opacity = String(sheenOpacity);
      if (sheenOpacity > 0) {
        /* Odlesk se odvozuje z vyhlazeného náklonu, ne přímo z kurzoru —
           jinak by při trhaném pointermove skákal. Jen transform. */
        const x = clamp(pose.ry / (2 * TILT_Y_DEG), -0.5, 0.5);
        const y = clamp(-pose.rx / (2 * TILT_X_DEG), -0.5, 0.5);
        gloss!.style.transform = `translate(${x * 30}%, ${y * 20}%) rotate(${x * 20}deg)`;
        light!.style.transform = `translate(${x * 33.3}%, ${y * 33.3}%)`;
      }
    }

    function setActive(next: boolean) {
      if (active === next) return;
      active = next;
      const value = next ? "transform" : "";
      card!.style.willChange = value;
      gloss!.style.willChange = value;
      light!.style.willChange = value;
    }

    function land() {
      phase = "live";
      zone!.style.opacity = "1";
      Object.assign(cur, REST);
      if (!landed) {
        landed = true;
        onLandedRef.current?.();
      }
    }

    function frame(now: number) {
      raf = 0;
      const dt = last ? Math.min(now - last, 64) : FRAME_MS;
      last = now;

      if (phase === "arriving") {
        if (!arrivalStart) arrivalStart = now + ARRIVAL_DELAY_MS;
        const t = (now - arrivalStart) / ARRIVAL_MS;
        if (t < 1) {
          const e = t <= 0 ? 0 : arrivalEase(t);
          apply(mix(FROM, REST, e), 0);
          zone!.style.opacity = String(clamp01(t / 0.45));
          schedule();
          return;
        }
        land();
        bobStart = now;
      }

      let target: Pose;
      let sheenTarget = 0;
      if (mode === "bob") {
        const amp = BOB_DEG * Math.min(1, (now - bobStart) / BOB_RAMP_MS);
        const w = ((now - bobStart) / BOB_PERIOD_MS) * Math.PI * 2;
        target = {
          ty: 0,
          rx: REST.rx + amp * Math.sin(w),
          ry: REST.ry + amp * Math.cos(w),
          s: 1,
        };
      } else if (pointer.inside) {
        target = {
          ty: 0,
          rx: -pointer.y * 2 * TILT_X_DEG,
          ry: pointer.x * 2 * TILT_Y_DEG,
          s: TILT_SCALE,
        };
        sheenTarget = 1;
      } else {
        target = REST;
      }

      const k = 1 - Math.pow(1 - LERP, dt / FRAME_MS);
      cur.ty += (target.ty - cur.ty) * k;
      cur.rx += (target.rx - cur.rx) * k;
      cur.ry += (target.ry - cur.ry) * k;
      cur.s += (target.s - cur.s) * k;
      cur.sheen += (sheenTarget - cur.sheen) * k;

      const settled =
        mode === "tilt" &&
        Math.abs(target.rx - cur.rx) < SETTLED &&
        Math.abs(target.ry - cur.ry) < SETTLED &&
        Math.abs(target.ty - cur.ty) < SETTLED &&
        Math.abs(target.s - cur.s) < SETTLED / 100 &&
        Math.abs(sheenTarget - cur.sheen) < SETTLED;

      if (settled) {
        Object.assign(cur, target, { sheen: sheenTarget });
        apply(cur, cur.sheen);
        setActive(false);
        last = 0;
        return;
      }
      apply(cur, cur.sheen);
      schedule();
    }

    function schedule() {
      if (raf || reducedQuery.matches || !onScreen || document.hidden) return;
      /* `will-change` až po přistání: prohlížeč s ním zamkne rozlišení
         vrstvy na měřítku, ve kterém ho dostal — z příletu (scale 0.7)
         by text zůstal rozmazaný po celou dobu pohupování. */
      if (phase === "live") setActive(true);
      raf = requestAnimationFrame(frame);
    }

    function stopStatic() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      pointer.inside = false;
      apply(REST, 0);
      setActive(false);
      land();
    }

    function onPointerMove(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      const r = zone!.getBoundingClientRect();
      pointer.x = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
      pointer.y = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
      pointer.inside = true;
      mode = "tilt";
      if (phase === "live") schedule();
    }

    function onPointerLeave(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      pointer.inside = false;
      if (phase === "live") schedule();
    }

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType !== "touch" || mode === "bob") return;
      mode = "bob";
      pointer.inside = false;
      bobStart = performance.now();
      if (phase === "live") schedule();
    }

    function pause() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      setActive(false);
      /* Přílet přerušený odjetím z obrazovky se přehraje znovu celý,
         ne aby certifikát po návratu jen „přistál". */
      if (phase === "arriving") arrivalStart = 0;
    }

    function updateVisibility() {
      if (onScreen && !document.hidden) {
        /* Náklon v klidu se hned první snímek zastaví sám. */
        schedule();
      } else {
        pause();
      }
    }

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen = entry?.isIntersecting ?? true;
            updateVisibility();
          });
    observer?.observe(zone);

    function onReducedChange() {
      if (reducedQuery.matches) {
        stopStatic();
      } else {
        if (mode === "bob") {
          bobStart = performance.now();
          schedule();
        }
      }
    }

    if (reducedQuery.matches) {
      stopStatic();
    } else {
      /* Výchozí poloha přiletu ještě před prvním vykreslením. */
      apply(FROM, 0);
      zone.style.opacity = "0";
      schedule();
    }

    zone.addEventListener("pointermove", onPointerMove);
    zone.addEventListener("pointerleave", onPointerLeave);
    zone.addEventListener("pointerdown", onPointerDown);
    reducedQuery.addEventListener("change", onReducedChange);
    document.addEventListener("visibilitychange", updateVisibility);

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
      if (raf) cancelAnimationFrame(raf);
      zone.removeEventListener("pointermove", onPointerMove);
      zone.removeEventListener("pointerleave", onPointerLeave);
      zone.removeEventListener("pointerdown", onPointerDown);
      reducedQuery.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <div aria-hidden="true">
      <div ref={zoneRef} className="flex justify-center [perspective:1100px]">
        <div
          ref={cardRef}
          className="relative w-full max-w-[520px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] [transform-style:preserve-3d]"
          style={{ ...DEPTH, transform: poseTransform(REST) }}
        >
          {face}
          {/* Odlesk: rovina těsně nad papírem, pod textem a pečetí. Vlastní
              ořez, protože `overflow: hidden` na kartě by zploštil 3D.
              Světlo pod kurzorem a tmavší okraje dávají papíru lesk;
              `soft-light` z náhledu by na téměř bílém papíru nebyl vidět. */}
          <div
            ref={sheenRef}
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{ opacity: 0, transform: "translateZ(1px)" }}
          >
            <div
              ref={lightRef}
              className="absolute -left-full -top-full h-[300%] w-[300%] bg-[radial-gradient(closest-side,rgba(255,255,255,0.5),rgba(255,255,255,0)_30%,rgba(12,14,26,0.1))]"
            />
            <div
              ref={glossRef}
              className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] bg-[linear-gradient(115deg,transparent_42%,rgba(255,255,255,0.7)_48.5%,transparent_55%)]"
            />
          </div>
        </div>
      </div>
      {/* Nápověda jen tam, kde náklon opravdu funguje: myš a pohyb povolený.
          Místo drží vždycky, ať se obsah pod ní neposouvá. */}
      <p className="mt-4 text-center font-mono text-xs text-paper/45 opacity-0 [@media(hover:hover)_and_(pointer:fine)_and_(prefers-reduced-motion:no-preference)]:opacity-100">
        ↖ přejeď myší po certifikátu
      </p>
    </div>
  );
}

function poseTransform(p: Pose): string {
  return `translate3d(0, ${p.ty}px, 0) rotateX(${p.rx}deg) rotateY(${p.ry}deg) scale(${p.s})`;
}

function mix(a: Pose, b: Pose, t: number): Pose {
  return {
    ty: a.ty + (b.ty - a.ty) * t,
    rx: a.rx + (b.rx - a.rx) * t,
    ry: a.ry + (b.ry - a.ry) * t,
    s: a.s + (b.s - a.s) * t,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

/** CSS `cubic-bezier()` jako funkce času — Newtonova metoda na ose x. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (t: number) => ((ax * t + bx) * t + cx) * t;
  const y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (target: number): number => {
    let t = target;
    for (let i = 0; i < 8; i++) {
      const err = x(t) - target;
      if (Math.abs(err) < 1e-5) break;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return y(clamp01(t));
  };
}
