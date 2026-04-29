# CAD Circuit Builder — Phase A Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tinkercad-like static circuit builder integrated into weeks-iot — kid opens a task, drags components onto a breadboard, draws wires, saves. No simulation, no Blockly. Phase B (simulation) and Phase C (Blockly) are out of scope.

**Architecture:** Self-contained React module (`<CADWorkspace>`) with internal `useReducer` for 60fps interactions, debounced sync (200ms) to existing `GameState.circuits[taskId]`. Engine follows Štěpán's strict rules: data-driven plane, PITCH=16 grid snap, `<wokwi-*>` web components, SVG wire overlay, shadow-DOM pin piercing.

**Tech Stack:** Next.js 16, React 19, TypeScript, `@wokwi/elements` (web components), Vitest (new — for unit tests).

**Spec:** `docs/superpowers/specs/2026-04-29-cad-circuit-builder-design.md`

---

## File structure summary

**New files:**

```
src/types/cad.ts
src/lib/cad/constants.ts
src/lib/cad/components.ts
src/lib/cad/circuit.ts
src/lib/cad/pins.ts
src/lib/cad/pin-selectors.ts          (output of prerequisite #1)
src/components/cad/CADModal.tsx
src/components/cad/CADWorkspace.tsx
src/components/cad/Plane.tsx
src/components/cad/TopBar.tsx
src/components/cad/Palette.tsx
src/components/cad/PaletteCard.tsx
src/components/cad/PlacedComponent.tsx
src/components/cad/WireLayer.tsx
src/components/cad/WirePath.tsx
src/components/cad/ZoomControls.tsx
src/components/cad/hooks/useCADReducer.ts
src/components/cad/hooks/useDragDrop.ts
src/components/cad/hooks/useWiring.ts
src/components/cad/hooks/usePinPositions.ts
src/components/cad/hooks/usePanZoom.ts
src/lib/cad/__tests__/circuit.test.ts
src/lib/cad/__tests__/components.test.ts
src/components/cad/hooks/__tests__/useCADReducer.test.ts
vitest.config.ts
public/cad/palette/*.png               (10 palette icon PNGs, 80×80)
```

**Modified files:**

```
src/types/index.ts                     (Task.cad, GameState.circuits, PerStudentAccount.circuits, SyncableState.circuits)
src/lib/storage.ts                     (createDefaultGameState, normalizePerStudentAccount)
src/lib/cloud-sync.ts                  (extractSyncableState)
src/lib/tasks.ts                       (cad.palette for first 8 beginner tasks)
src/components/providers/GameStateProvider.tsx  (SAVE_CIRCUIT action, syncCurrentStudent, LOGIN_STUDENT)
src/components/screens/TaskDetail.tsx  (CAD button, lazy CADModal import)
package.json                           (add @wokwi/elements, vitest, @testing-library/react)
.gitignore                             (vitest cache)
```

---

# Phase 0 — Prerequisites & Setup

These tasks must complete before any feature implementation. They reduce unknowns flagged in the spec ("Implementation prerequisites" section).

## Task 1: Reverse-engineer wokwi pin selectors

**Goal:** Produce a complete `{ wokwiTag → { logicalPinName → cssSelector } }` mapping for all 10 component types. Without this, the wire engine cannot snap to pin centers.

**Files:**
- Create: `src/lib/cad/pin-selectors.ts`
- Create scratch HTML: `scratch/wokwi-inspect.html` (delete before merging)

- [ ] **Step 1: Install wokwi/elements**

```bash
npm install @wokwi/elements@^2
```

Expected: Install succeeds. Note any peer-dep warnings about `lit`.

- [ ] **Step 2: Create scratch HTML for shadow DOM inspection**

Create `scratch/wokwi-inspect.html`:

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Wokwi pin inspector</title></head>
<body>
  <h2>LED red</h2>           <wokwi-led color="red"></wokwi-led>
  <h2>Resistor 220</h2>      <wokwi-resistor value="220"></wokwi-resistor>
  <h2>Pushbutton</h2>        <wokwi-pushbutton color="red"></wokwi-pushbutton>
  <h2>Buzzer</h2>            <wokwi-buzzer></wokwi-buzzer>
  <h2>Potentiometer</h2>     <wokwi-potentiometer></wokwi-potentiometer>
  <h2>Photoresistor</h2>     <wokwi-photoresistor-sensor></wokwi-photoresistor-sensor>
  <h2>RGB LED</h2>           <wokwi-led-rgb></wokwi-led-rgb>
  <h2>Arduino Uno</h2>       <wokwi-arduino-uno></wokwi-arduino-uno>
  <h2>Breadboard half</h2>   <wokwi-breadboard-half></wokwi-breadboard-half>
  <script type="module">
    import "@wokwi/elements";
  </script>
</body></html>
```

- [ ] **Step 3: Inspect each component in DevTools**

Open `scratch/wokwi-inspect.html` via Vite or `npx serve scratch/`. For each component:
- Open DevTools → Elements
- Expand `#shadow-root` → identify pin element selectors
- For breadboard-half: confirm whether pins use `[data-pin="A1"]` or `<g class="pin-A1">` or similar pattern
- Document findings as you go

Expected output: notes per component listing how pins are addressed.

- [ ] **Step 4: Write `pin-selectors.ts`**

Create `src/lib/cad/pin-selectors.ts`:

```ts
// Maps logical pin name → CSS selector inside the wokwi-* shadow DOM.
// Output of reverse-engineering scratch/wokwi-inspect.html.
// If wokwi/elements upgrades break these, rerun the scratch inspector.

export type PinSelectorMap = Record<string, string>;

export const PIN_SELECTORS: Record<string, PinSelectorMap> = {
  "wokwi-led":               { /* anode, cathode → fill in from inspection */ },
  "wokwi-led-rgb":           { /* r, g, b, cathode */ },
  "wokwi-resistor":          { /* a, b */ },
  "wokwi-pushbutton":        { /* 1a, 2a, 1b, 2b */ },
  "wokwi-buzzer":            { /* +, − */ },
  "wokwi-potentiometer":     { /* terminal-a, signal, terminal-b */ },
  "wokwi-photoresistor-sensor": { /* dout, gnd, vcc, aout */ },
  "wokwi-arduino-uno":       { /* D0..D13, A0..A5, GND×3, 5V, 3V3, VIN, RESET, AREF */ },
  "wokwi-breadboard-half":   { /* 170 pins — likely a single pattern selector,
                                  filled from inspection */ },
};
```

Fill the placeholders with actual selectors from inspection notes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cad/pin-selectors.ts
git rm -rf scratch/
git commit -m "feat(cad): pin selector map from wokwi/elements shadow-DOM inspection"
```

**Budget warning:** if step 3 takes more than 4 hours, escalate. The wokwi pin model may not be sufficient — may need to consider a custom breadboard. Surface to user before proceeding.

---

## Task 2: Bundle size measurement & React 19 smoke test

**Goal:** Verify `@wokwi/elements` bundle is acceptable and that web components render in React 19 without warnings.

**Files:**
- Create scratch component: `src/app/wokwi-smoke/page.tsx` (delete before merging)

- [ ] **Step 1: Create smoke-test page**

```tsx
// src/app/wokwi-smoke/page.tsx
"use client";
import { useEffect } from "react";

export default function Page() {
  useEffect(() => {
    import("@wokwi/elements");
  }, []);
  return (
    <div style={{ padding: 40 }}>
      <h2>Wokwi smoke test (React 19)</h2>
      <wokwi-led color="red" />
      <wokwi-resistor value="220" />
      <wokwi-pushbutton color="red" />
    </div>
  );
}
```

Add a TypeScript shim at top:

```ts
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "wokwi-led": React.HTMLAttributes<HTMLElement> & { color?: string };
      "wokwi-resistor": React.HTMLAttributes<HTMLElement> & { value?: string };
      "wokwi-pushbutton": React.HTMLAttributes<HTMLElement> & { color?: string };
    }
  }
}
```

- [ ] **Step 2: Run dev server, open `/wokwi-smoke`, check console**

```bash
npm run dev
# open http://localhost:3000/wokwi-smoke
```

Expected: 3 components render visually. Console has zero warnings about unknown elements / unrecognized props. If warnings appear, document workaround in `pin-selectors.ts` header comment.

- [ ] **Step 3: Production build + bundle measurement**

```bash
npm run build
ls -lh .next/static/chunks/ | grep -i wokwi
```

Or use `next build`'s output table — note the size of the chunk that contains wokwi.

Expected: chunk under 200 kB gzipped. If over, document in spec risks; consider selective imports (`import "@wokwi/elements/dist/led.js"`).

- [ ] **Step 4: Delete smoke-test page, commit findings**

```bash
rm -rf src/app/wokwi-smoke
git add -p   # confirm only smoke-test removed
git commit -m "chore(cad): wokwi/elements smoke-test passed (bundle: NN kB gz)"
```

If the smoke test failed, do NOT proceed with this plan — surface to user.

---

## Task 3: Set up Vitest

**Goal:** Add unit-test infrastructure. Codebase has none today.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install vitest + jsdom + testing-library**

```bash
npm install -D vitest@^2 jsdom @testing-library/react@^16 @testing-library/dom @vitejs/plugin-react
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 3: Add `test` script to package.json**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Add vitest cache to .gitignore**

Append to `.gitignore`:
```
# vitest
.vitest-cache/
```

- [ ] **Step 5: Sanity test**

Create `src/lib/__tests__/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json .gitignore src/lib/__tests__/sanity.test.ts
git commit -m "chore: add vitest for unit testing"
```

---

## Task 4: TypeScript ambient types for `<wokwi-*>` JSX

**Goal:** Define JSX intrinsic elements once for all wokwi tags so React/TS doesn't error on them.

**Files:**
- Create: `src/types/wokwi-jsx.d.ts`

- [ ] **Step 1: Write ambient declaration file**

```ts
// src/types/wokwi-jsx.d.ts
import type React from "react";

type WokwiCommon = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "wokwi-led":              WokwiCommon & { color?: string; brightness?: string | number; value?: string };
      "wokwi-led-rgb":          WokwiCommon;
      "wokwi-resistor":         WokwiCommon & { value?: string };
      "wokwi-pushbutton":       WokwiCommon & { color?: string };
      "wokwi-buzzer":           WokwiCommon;
      "wokwi-potentiometer":    WokwiCommon;
      "wokwi-photoresistor-sensor": WokwiCommon & { value?: string | number };
      "wokwi-arduino-uno":      WokwiCommon;
      "wokwi-breadboard-half":  WokwiCommon;
    }
  }
}

export {};
```

- [ ] **Step 2: Verify TypeScript picks it up**

```bash
npx tsc --noEmit
```

Expected: no errors. (Add `src/types/**/*.d.ts` to `tsconfig.json` includes if not already.)

- [ ] **Step 3: Commit**

```bash
git add src/types/wokwi-jsx.d.ts
git commit -m "chore(cad): ambient JSX types for <wokwi-*> custom elements"
```

---

# Phase 1 — Foundation: types, constants, registry, helpers

## Task 5: CAD types

**Files:**
- Create: `src/types/cad.ts`

- [ ] **Step 1: Write the type file**

```ts
// src/types/cad.ts

export type ComponentType =
  | "arduino-uno"
  | "breadboard-half"
  | "led-red" | "led-yellow" | "led-green" | "led-blue" | "led-rgb"
  | "resistor-220"
  | "pushbutton"
  | "piezo-buzzer"
  | "potentiometer"
  | "photoresistor";

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  x: number;                                 // PITCH-aligned plane coords (px)
  y: number;
  rotation: 0 | 90 | 180 | 270;              // v1 always 0 — field reserved for forward-compat
}

export interface PinRef {
  compId: string;
  pinName: string;                           // e.g. "anode", "D13", "row-A-15"
}

export interface Wire {
  id: string;
  from: PinRef;
  to: PinRef;
  color?: "gray";                            // v1 always gray
}

export interface Circuit {
  comps: CircuitComponent[];
  wires: Wire[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/cad.ts
git commit -m "feat(cad): Circuit type definitions"
```

---

## Task 6: CAD constants

**Files:**
- Create: `src/lib/cad/constants.ts`

- [ ] **Step 1: Write the constants file**

```ts
// src/lib/cad/constants.ts

export const PITCH = 16;                     // px between breadboard hole centers (Štěpán's brief)

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3.0;
export const ZOOM_STEP = 0.1;
export const ZOOM_DEFAULT = 1.0;

export const GRID_DOT_SIZE = 1;              // grid background dot diameter (px)
export const GRID_DOT_OPACITY = 0.18;

export const SAVE_DEBOUNCE_MS = 200;         // debounce window before pushing to GameState

export const PIN_HIT_AREA = 12;              // overlay hit-area square side (px) for pin clicks

export const WIRE_COLOR_DEFAULT = "#9ca3af"; // tailwind gray-400
export const WIRE_COLOR_SELECTED = "#fbbf24";// tailwind amber-400
export const WIRE_COLOR_DRAFT = "#60a5fa";   // tailwind blue-400 (in-progress wire)
export const WIRE_STROKE_WIDTH = 2;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cad/constants.ts
git commit -m "feat(cad): geometry and visual constants"
```

---

## Task 7: Component registry

**Files:**
- Create: `src/lib/cad/components.ts`
- Create: `src/lib/cad/__tests__/components.test.ts`

- [ ] **Step 1: Write the failing registry consistency test first**

```ts
// src/lib/cad/__tests__/components.test.ts
import { describe, it, expect } from "vitest";
import { COMPONENT_REGISTRY, getComponentSpec } from "../components";

describe("component registry", () => {
  it("has a spec for every ComponentType", () => {
    const required: string[] = [
      "arduino-uno", "breadboard-half",
      "led-red", "led-yellow", "led-green", "led-blue", "led-rgb",
      "resistor-220", "pushbutton", "piezo-buzzer",
      "potentiometer", "photoresistor",
    ];
    for (const t of required) {
      expect(COMPONENT_REGISTRY[t], `missing spec for ${t}`).toBeDefined();
    }
  });

  it("each spec declares ≥1 pin", () => {
    for (const [t, spec] of Object.entries(COMPONENT_REGISTRY)) {
      expect(spec.pins.length, `${t} has no pins`).toBeGreaterThan(0);
    }
  });

  it("each spec has positive span", () => {
    for (const [t, spec] of Object.entries(COMPONENT_REGISTRY)) {
      expect(spec.spanX, `${t} spanX`).toBeGreaterThan(0);
      expect(spec.spanY, `${t} spanY`).toBeGreaterThan(0);
    }
  });

  it("getComponentSpec throws on unknown type", () => {
    expect(() => getComponentSpec("nonexistent" as never)).toThrow();
  });
});
```

Run: `npm test -- components.test`
Expected: FAIL with "Cannot find module '../components'".

- [ ] **Step 2: Write the registry**

```ts
// src/lib/cad/components.ts
import type { ComponentType } from "@/types/cad";

export interface PinSpec {
  name: string;                              // logical pin name
  dx: number;                                // PITCH offset from component origin
  dy: number;
}

export interface ComponentSpec {
  type: ComponentType;
  label: string;                             // Czech UI label
  wokwiTag: string;
  wokwiAttrs?: Record<string, string>;
  pins: PinSpec[];
  spanX: number;                             // PITCH units
  spanY: number;                             // PITCH units
  paletteIcon: string;                       // path under public/
  scale: number;                             // CSS transform scale to fit on PITCH grid
}

const led = (color: string): Omit<ComponentSpec, "type" | "label" | "paletteIcon"> => ({
  wokwiTag: "wokwi-led",
  wokwiAttrs: { color },
  pins: [
    { name: "anode",   dx: 0, dy: 0 },
    { name: "cathode", dx: 0, dy: 1 },
  ],
  spanX: 1, spanY: 1, scale: 0.5,            // tweak after visual review
});

export const COMPONENT_REGISTRY: Record<ComponentType, ComponentSpec> = {
  "arduino-uno": {
    type: "arduino-uno",
    label: "Arduino Uno",
    wokwiTag: "wokwi-arduino-uno",
    pins: [
      // Digital
      { name: "D0",  dx: 0,  dy: 0 }, { name: "D1",  dx: 1,  dy: 0 },
      { name: "D2",  dx: 2,  dy: 0 }, { name: "D3",  dx: 3,  dy: 0 },
      { name: "D4",  dx: 4,  dy: 0 }, { name: "D5",  dx: 5,  dy: 0 },
      { name: "D6",  dx: 6,  dy: 0 }, { name: "D7",  dx: 7,  dy: 0 },
      { name: "D8",  dx: 8,  dy: 0 }, { name: "D9",  dx: 9,  dy: 0 },
      { name: "D10", dx: 10, dy: 0 }, { name: "D11", dx: 11, dy: 0 },
      { name: "D12", dx: 12, dy: 0 }, { name: "D13", dx: 13, dy: 0 },
      { name: "GND-1", dx: 14, dy: 0 },
      // Analog
      { name: "A0", dx: 0, dy: 8 }, { name: "A1", dx: 1, dy: 8 },
      { name: "A2", dx: 2, dy: 8 }, { name: "A3", dx: 3, dy: 8 },
      { name: "A4", dx: 4, dy: 8 }, { name: "A5", dx: 5, dy: 8 },
      // Power
      { name: "5V",   dx: 7, dy: 8 },
      { name: "3V3",  dx: 8, dy: 8 },
      { name: "GND-2",dx: 9, dy: 8 },
      { name: "GND-3",dx: 10,dy: 8 },
      { name: "VIN",  dx: 11,dy: 8 },
      { name: "RESET",dx: 12,dy: 8 },
      { name: "AREF", dx: 13,dy: 8 },
    ],
    spanX: 16, spanY: 10, scale: 0.6,
    paletteIcon: "/cad/palette/arduino-uno.png",
  },
  "breadboard-half": {
    type: "breadboard-half",
    label: "Breadboard",
    wokwiTag: "wokwi-breadboard-half",
    pins: generateBreadboardHalfPins(),
    spanX: 30, spanY: 10, scale: 1.0,
    paletteIcon: "/cad/palette/breadboard-half.png",
  },
  "led-red":    { ...led("red"),    type: "led-red",    label: "LED červená", paletteIcon: "/cad/palette/led-red.png" },
  "led-yellow": { ...led("yellow"), type: "led-yellow", label: "LED žlutá",   paletteIcon: "/cad/palette/led-yellow.png" },
  "led-green":  { ...led("green"),  type: "led-green",  label: "LED zelená",  paletteIcon: "/cad/palette/led-green.png" },
  "led-blue":   { ...led("blue"),   type: "led-blue",   label: "LED modrá",   paletteIcon: "/cad/palette/led-blue.png" },
  "led-rgb": {
    type: "led-rgb", label: "LED RGB",
    wokwiTag: "wokwi-led-rgb",
    pins: [
      { name: "r",       dx: 0, dy: 0 },
      { name: "cathode", dx: 0, dy: 1 },
      { name: "g",       dx: 0, dy: 2 },
      { name: "b",       dx: 0, dy: 3 },
    ],
    spanX: 1, spanY: 4, scale: 0.6,
    paletteIcon: "/cad/palette/led-rgb.png",
  },
  "resistor-220": {
    type: "resistor-220", label: "Rezistor 220 Ω",
    wokwiTag: "wokwi-resistor",
    wokwiAttrs: { value: "220" },
    pins: [{ name: "a", dx: 0, dy: 0 }, { name: "b", dx: 4, dy: 0 }],
    spanX: 4, spanY: 1, scale: 0.7,
    paletteIcon: "/cad/palette/resistor-220.png",
  },
  "pushbutton": {
    type: "pushbutton", label: "Tlačítko",
    wokwiTag: "wokwi-pushbutton",
    wokwiAttrs: { color: "red" },
    pins: [
      { name: "1a", dx: 0, dy: 0 }, { name: "2a", dx: 2, dy: 0 },
      { name: "1b", dx: 0, dy: 2 }, { name: "2b", dx: 2, dy: 2 },
    ],
    spanX: 2, spanY: 2, scale: 0.7,
    paletteIcon: "/cad/palette/pushbutton.png",
  },
  "piezo-buzzer": {
    type: "piezo-buzzer", label: "Piezo buzzer",
    wokwiTag: "wokwi-buzzer",
    pins: [{ name: "+", dx: 0, dy: 0 }, { name: "-", dx: 1, dy: 0 }],
    spanX: 2, spanY: 2, scale: 0.6,
    paletteIcon: "/cad/palette/piezo-buzzer.png",
  },
  "potentiometer": {
    type: "potentiometer", label: "Potenciometr",
    wokwiTag: "wokwi-potentiometer",
    pins: [
      { name: "terminal-a", dx: 0, dy: 0 },
      { name: "signal",     dx: 1, dy: 0 },
      { name: "terminal-b", dx: 2, dy: 0 },
    ],
    spanX: 3, spanY: 1, scale: 0.5,
    paletteIcon: "/cad/palette/potentiometer.png",
  },
  "photoresistor": {
    type: "photoresistor", label: "Fotorezistor",
    wokwiTag: "wokwi-photoresistor-sensor",
    pins: [
      { name: "dout", dx: 0, dy: 0 },
      { name: "gnd",  dx: 1, dy: 0 },
      { name: "vcc",  dx: 2, dy: 0 },
      { name: "aout", dx: 3, dy: 0 },
    ],
    spanX: 4, spanY: 1, scale: 0.6,
    paletteIcon: "/cad/palette/photoresistor.png",
  },
};

function generateBreadboardHalfPins(): PinSpec[] {
  const pins: PinSpec[] = [];
  // Power rails (top + bottom)
  // Top + and − rails: 30 holes each (x=0..29), y at 0 / 1 / 8 / 9
  for (let x = 0; x < 30; x++) {
    pins.push({ name: `top-+-${x}`, dx: x, dy: 0 });
    pins.push({ name: `top-−-${x}`, dx: x, dy: 1 });
    pins.push({ name: `bot-+-${x}`, dx: x, dy: 8 });
    pins.push({ name: `bot-−-${x}`, dx: x, dy: 9 });
  }
  // Bus rows above trench: rows A..E, columns 1..30, y=2..6
  for (const row of ["A", "B", "C", "D", "E"]) {
    const dy = 2 + ["A", "B", "C", "D", "E"].indexOf(row);
    for (let col = 1; col <= 30; col++) {
      pins.push({ name: `row-${row}-${col}`, dx: col - 1, dy });
    }
  }
  // Trench at dy=7 (skip — 1 PITCH gap)
  // Bus rows below trench: F..J, y=8..12 ... NOTE: spanY=10 means we have y=0..9 only.
  // Spec says trench is at dy=7; below trench rows are F..J BUT they share y=8..9 with rails.
  // For Phase A simplicity: keep above-trench A..E only. Below-trench F..J resolved
  // when we read actual wokwi-breadboard-half DOM positions in pin-selectors.ts.
  // TODO: revisit during integration with pin-selectors.ts (Task 16).
  return pins;
}

export function getComponentSpec(type: ComponentType): ComponentSpec {
  const spec = COMPONENT_REGISTRY[type];
  if (!spec) throw new Error(`Unknown ComponentType: ${type}`);
  return spec;
}
```

Run: `npm test -- components.test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cad/components.ts src/lib/cad/__tests__/components.test.ts
git commit -m "feat(cad): component registry for 10 Phase-A types + consistency tests"
```

**Note:** The breadboard pin geometry in `generateBreadboardHalfPins()` is a starting estimate. Step in Task 16 will reconcile with real wokwi pin positions. The TODO comment is intentional and resolved later.

---

## Task 8: Circuit helpers

**Files:**
- Create: `src/lib/cad/circuit.ts`
- Create: `src/lib/cad/__tests__/circuit.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/cad/__tests__/circuit.test.ts
import { describe, it, expect } from "vitest";
import { createDefaultCircuit, applyTaskSeed, isCircuitEmpty } from "../circuit";

describe("createDefaultCircuit", () => {
  it("returns Arduino + breadboard, no wires", () => {
    const c = createDefaultCircuit();
    expect(c.comps).toHaveLength(2);
    expect(c.comps.map(co => co.type).sort()).toEqual(["arduino-uno", "breadboard-half"]);
    expect(c.wires).toEqual([]);
  });

  it("each call produces fresh ids", () => {
    const a = createDefaultCircuit();
    const b = createDefaultCircuit();
    expect(a.comps[0].id).not.toBe(b.comps[0].id);
  });
});

describe("applyTaskSeed", () => {
  it("uses task.cad.seed when provided", () => {
    const seed = [{ id: "x", type: "led-red" as const, x: 0, y: 0, rotation: 0 as const }];
    const c = applyTaskSeed({ cad: { palette: ["led-red"], seed } } as never);
    expect(c.comps).toEqual(seed);
  });

  it("falls back to default when task.cad.seed missing", () => {
    const c = applyTaskSeed({ cad: { palette: ["led-red"] } } as never);
    expect(c.comps).toHaveLength(2);
  });

  it("falls back to default when task.cad missing", () => {
    const c = applyTaskSeed({} as never);
    expect(c.comps).toHaveLength(2);
  });
});

describe("isCircuitEmpty", () => {
  it("treats default circuit as empty (only seed comps, no wires)", () => {
    expect(isCircuitEmpty(createDefaultCircuit())).toBe(true);
  });
});
```

Run: `npm test -- circuit.test`
Expected: FAIL.

- [ ] **Step 2: Implement helpers**

```ts
// src/lib/cad/circuit.ts
import type { Circuit, CircuitComponent } from "@/types/cad";
import type { Task } from "@/types";
import { PITCH } from "./constants";

function uid(): string {
  return crypto.randomUUID();
}

export function createDefaultCircuit(): Circuit {
  return {
    comps: [
      { id: uid(), type: "arduino-uno",     x: 0,                y: 0, rotation: 0 },
      { id: uid(), type: "breadboard-half", x: 18 * PITCH,       y: 0, rotation: 0 },
    ],
    wires: [],
  };
}

export function applyTaskSeed(task: Pick<Task, "cad">): Circuit {
  const seed = task.cad?.seed;
  if (!seed) return createDefaultCircuit();
  return { comps: seed.map(c => ({ ...c })), wires: [] };
}

export function isCircuitEmpty(c: Circuit): boolean {
  if (c.wires.length > 0) return false;
  // Has only the default seed components → still considered "empty"
  if (c.comps.length === 2 && c.comps.every(co => co.type === "arduino-uno" || co.type === "breadboard-half")) {
    return true;
  }
  return false;
}

export function snapToGrid(value: number): number {
  return Math.round(value / PITCH) * PITCH;
}

export function snapPoint(x: number, y: number): { x: number; y: number } {
  return { x: snapToGrid(x), y: snapToGrid(y) };
}
```

Run: `npm test -- circuit.test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cad/circuit.ts src/lib/cad/__tests__/circuit.test.ts
git commit -m "feat(cad): circuit factory + task seed helpers + grid snap"
```

---

# Phase 2 — GameState integration

## Task 9: Extend type definitions

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `cad` to `Task` interface**

Find the existing `Task` interface in `src/types/index.ts` (likely near top). Add at the bottom of the interface:

```ts
import type { Circuit, CircuitComponent, ComponentType } from "@/types/cad";

export interface Task {
  // ... existing fields preserved ...
  cad?: {
    palette: ComponentType[];
    seed?: CircuitComponent[];
  };
}
```

- [ ] **Step 2: Add `circuits` to `PerStudentAccount`, `GameState`, `SyncableState`**

```ts
export interface PerStudentAccount {
  account: AccountState;
  tasks: Record<string, TaskState>;
  sections: Record<SectionId, { unlocked: boolean }>;
  circuits: Record<string, Circuit>;          // ← new
}

export interface GameState {
  // ... existing fields preserved ...
  circuits: Record<string, Circuit>;          // ← new (current student's view)
}

export interface SyncableState {
  account: AccountState;
  tasks: Record<string, TaskState>;
  sections: Record<SectionId, { unlocked: boolean }>;
  circuits: Record<string, Circuit>;          // ← new
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected errors: callers of `createDefaultGameState`, `loadGameState`, etc., that don't yet supply `circuits`. Fix in subsequent tasks. For this commit, accept the errors.

- [ ] **Step 4: Commit (with broken TS — fixed in Task 10)**

```bash
git add src/types/index.ts
git commit -m "feat(cad): extend Task/GameState/PerStudentAccount/SyncableState with circuits"
```

---

## Task 10: Default state initialization

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Update `createDefaultGameState`**

Find `createDefaultGameState` (around line 45). Add `circuits: {}` to the return object:

```ts
export function createDefaultGameState(): GameState {
  return {
    version: CONFIG_VERSION,
    selectedTopic: null,
    config: { ...DEFAULT_CONFIG },
    accounts: {},
    currentStudentNumber: null,
    adminPreviewActive: false,
    adminAuthenticated: false,
    codeDrafts: {},
    account: createDefaultAccountState(),
    tasks: createDefaultTasks(),
    sections: createDefaultSections(),
    screen: createDefaultScreenState(),
    linkedUserId: null,
    circuits: {},                              // ← new
  };
}
```

- [ ] **Step 2: Update `normalizePerStudentAccount` for forward-compat**

Find `normalizePerStudentAccount` (around line 76):

```ts
function normalizePerStudentAccount(student: PerStudentAccount): PerStudentAccount {
  return {
    ...student,
    account: normalizeAccountState(student.account),
    circuits: student.circuits ?? {},          // ← new
  };
}
```

- [ ] **Step 3: Update `loadGameState` for forward-compat**

Find `loadGameState` (around line 83). After parsing, ensure `circuits` defaults:

```ts
export function loadGameState(): GameState {
  if (typeof window === "undefined") return createDefaultGameState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultGameState();
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== CONFIG_VERSION) return createDefaultGameState();
    return {
      ...parsed,
      circuits: parsed.circuits ?? {},         // ← new (forward-compat for old localStorage)
      account: normalizeAccountState(parsed.account),
      accounts: Object.fromEntries(
        Object.entries(parsed.accounts ?? {}).map(([k, v]) => [k, normalizePerStudentAccount(v)]),
      ),
    };
    // ... rest unchanged
  } catch {
    return createDefaultGameState();
  }
}
```

(Existing structure may differ slightly — preserve everything else; just inject the `circuits` default.)

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors in `storage.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat(cad): initialize circuits in default state + forward-compat normalization"
```

---

## Task 11: SAVE_CIRCUIT reducer action

**Files:**
- Modify: `src/components/providers/GameStateProvider.tsx`

- [ ] **Step 1: Add the action to the `Action` type**

Find the `Action` type union (early in the file). Add:

```ts
export type Action =
  // ...existing...
  | { type: "SAVE_CIRCUIT"; taskId: string; circuit: Circuit };
```

Add the import at the top:

```ts
import type { Circuit } from "@/types/cad";
```

- [ ] **Step 2: Add the reducer case**

Find the `reducer` function. Add a case:

```ts
case "SAVE_CIRCUIT": {
  if (state.adminPreviewActive) return state;  // admin preview cannot mutate student data
  const circuits = { ...state.circuits, [action.taskId]: action.circuit };
  return syncCurrentStudent({ ...state, circuits });
}
```

(`syncCurrentStudent` will be updated in Task 12 to copy circuits.)

- [ ] **Step 3: Verify TS still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/providers/GameStateProvider.tsx
git commit -m "feat(cad): SAVE_CIRCUIT reducer action with admin-preview guard"
```

---

## Task 12: Multi-student sync — `syncCurrentStudent` and `LOGIN_STUDENT`

**Files:**
- Modify: `src/components/providers/GameStateProvider.tsx`

- [ ] **Step 1: Update `syncCurrentStudent` to copy circuits**

Find `syncCurrentStudent` (line ~79). Add `circuits` to the snapshot:

```ts
function syncCurrentStudent(state: GameState): GameState {
  const n = state.currentStudentNumber;
  if (!n) return state;
  return {
    ...state,
    accounts: {
      ...state.accounts,
      [n]: {
        account:  state.account,
        tasks:    state.tasks,
        sections: state.sections,
        circuits: state.circuits,              // ← new
      },
    },
  };
}
```

- [ ] **Step 2: Update `LOGIN_STUDENT` to restore circuits**

Find the `LOGIN_STUDENT` case in the reducer. Restore `circuits` from `accounts[n]` along with existing fields:

```ts
case "LOGIN_STUDENT": {
  const n = action.studentNumber;
  const stored = state.accounts[n];
  return {
    ...state,
    currentStudentNumber: n,
    account:  stored?.account  ?? createDefaultAccountState(),
    tasks:    stored?.tasks    ?? createDefaultTasks(),
    sections: stored?.sections ?? createDefaultSections(),
    circuits: stored?.circuits ?? {},          // ← new
    screen: { currentScreen: "task-list", pinLevel: "daily" },
  };
}
```

(The existing handler's exact shape may differ — preserve all existing assignments and just add `circuits`.)

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Open browser DevTools → Application → Local Storage. Confirm after login that `circuits` exists in both top-level and `accounts[N]` (initially `{}`).

- [ ] **Step 4: Commit**

```bash
git add src/components/providers/GameStateProvider.tsx
git commit -m "feat(cad): multi-student sync for circuits via syncCurrentStudent + LOGIN_STUDENT"
```

---

## Task 13: Cloud sync extension

**Files:**
- Modify: `src/lib/cloud-sync.ts`

- [ ] **Step 1: Add circuits to `extractSyncableState`**

```ts
export function extractSyncableState(state: GameState): SyncableState {
  return {
    account:  state.account,
    tasks:    state.tasks,
    sections: state.sections,
    circuits: state.circuits,                  // ← new
  };
}
```

- [ ] **Step 2: Verify cloud sync types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/cloud-sync.ts
git commit -m "feat(cad): include circuits in cloud-sync payload"
```

---

# Phase 3 — Per-task CAD config

## Task 14: Add `cad.palette` to first 8 beginner tasks

**Files:**
- Modify: `src/lib/tasks.ts`

- [ ] **Step 1: Add `cad` field to each beginner task**

Edit the 8 beginner tasks per the spec. Example for `beginner-led`:

```ts
{
  id: "beginner-led",
  // ... existing fields preserved ...
  cad: {
    palette: ["led-red", "resistor-220", "pushbutton"],
  },
},
```

Apply per spec table:

| Task ID | palette |
|---|---|
| `beginner-led`              | `["led-red", "resistor-220", "pushbutton"]` |
| `beginner-buzzer-button`    | `["piezo-buzzer", "pushbutton"]` |
| `beginner-potentiometer`    | `["potentiometer", "led-red", "resistor-220"]` |
| `beginner-pwm-led`          | `["led-red", "resistor-220"]` |
| `beginner-traffic-light`    | `["led-red", "led-yellow", "led-green", "resistor-220"]` |
| `beginner-light-sensor`     | `["photoresistor", "led-red", "resistor-220"]` |
| `beginner-and-or`           | `["led-red", "resistor-220", "pushbutton"]` |
| `beginner-rgb-button`       | `["led-rgb", "resistor-220", "pushbutton"]` |

Advanced and Expert tasks remain without `cad` field — they will not show the CAD button.

- [ ] **Step 2: Verify TS compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/tasks.ts
git commit -m "feat(cad): per-task palette config for first 8 beginner tasks"
```

---

# Phase 4 — Pin resolution

## Task 15: Pin position resolver (shadow-DOM piercing)

**Files:**
- Create: `src/lib/cad/pins.ts`

- [ ] **Step 1: Write the resolver**

```ts
// src/lib/cad/pins.ts
import { PIN_SELECTORS } from "./pin-selectors";
import { getComponentSpec } from "./components";
import type { ComponentType } from "@/types/cad";

export interface PinScreenPos { x: number; y: number; }

/**
 * Resolves the screen-space center of a pin by querying the shadow DOM
 * of the wokwi web component and mapping to the workspace plane coords.
 *
 * `planeEl` must be the #workspace-plane element (so we can subtract its bounding rect
 * to convert client → plane coords).
 *
 * Returns null if the component or pin selector is not yet mounted.
 */
export function resolvePinPosition(
  componentEl: HTMLElement,
  componentType: ComponentType,
  pinName: string,
  planeEl: HTMLElement,
): PinScreenPos | null {
  const spec = getComponentSpec(componentType);
  const selectorMap = PIN_SELECTORS[spec.wokwiTag];
  const selector = selectorMap?.[pinName];

  if (!selector) return null;
  const shadow = componentEl.shadowRoot;
  if (!shadow) return null;

  const pinEl = shadow.querySelector(selector) as SVGGraphicsElement | HTMLElement | null;
  if (!pinEl) return null;

  const r = pinEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  const pr = planeEl.getBoundingClientRect();
  return { x: cx - pr.left, y: cy - pr.top };
}
```

- [ ] **Step 2: Reconcile breadboard pin geometry**

After Task 1's pin-selectors.ts is complete, return to `src/lib/cad/components.ts` and update `generateBreadboardHalfPins()` to match the actual breadboard layout (especially F..J rows below trench). Re-run components.test to confirm it still passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cad/pins.ts src/lib/cad/components.ts
git commit -m "feat(cad): pin position resolver via shadow-DOM piercing"
```

---

## Task 16: usePinPositions hook (cached)

**Files:**
- Create: `src/components/cad/hooks/usePinPositions.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/components/cad/hooks/usePinPositions.ts
import { useCallback, useRef } from "react";
import { resolvePinPosition, type PinScreenPos } from "@/lib/cad/pins";
import type { ComponentType } from "@/types/cad";

interface CacheKey { compId: string; pinName: string; }

/**
 * Caches pin positions by `compId:pinName`. Cache is invalidated by callers
 * when a component moves or the plane transforms (zoom/pan/scroll).
 *
 * Usage:
 *   const { getPin, invalidate, invalidateAll } = usePinPositions(planeRef);
 *   const pos = getPin("comp-1", "anode", componentEl, "led-red");
 */
export function usePinPositions(planeRef: React.RefObject<HTMLElement>) {
  const cache = useRef(new Map<string, PinScreenPos>());

  const getPin = useCallback((
    compId: string,
    pinName: string,
    componentEl: HTMLElement,
    componentType: ComponentType,
  ): PinScreenPos | null => {
    const key = `${compId}:${pinName}`;
    const cached = cache.current.get(key);
    if (cached) return cached;

    const plane = planeRef.current;
    if (!plane) return null;

    const pos = resolvePinPosition(componentEl, componentType, pinName, plane);
    if (pos) cache.current.set(key, pos);
    return pos;
  }, [planeRef]);

  const invalidate = useCallback((compId: string) => {
    for (const k of cache.current.keys()) {
      if (k.startsWith(`${compId}:`)) cache.current.delete(k);
    }
  }, []);

  const invalidateAll = useCallback(() => {
    cache.current.clear();
  }, []);

  return { getPin, invalidate, invalidateAll };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cad/hooks/usePinPositions.ts
git commit -m "feat(cad): usePinPositions hook with per-component cache invalidation"
```

---

# Phase 5 — CAD shell & state sync

## Task 17: useCADReducer (local state)

**Files:**
- Create: `src/components/cad/hooks/useCADReducer.ts`
- Create: `src/components/cad/hooks/__tests__/useCADReducer.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/components/cad/hooks/__tests__/useCADReducer.test.ts
import { describe, it, expect } from "vitest";
import { cadReducer, initCADState } from "../useCADReducer";
import { createDefaultCircuit } from "@/lib/cad/circuit";

describe("cadReducer", () => {
  it("PLACE_COMPONENT appends a component", () => {
    const init = initCADState(createDefaultCircuit());
    const next = cadReducer(init, {
      type: "PLACE_COMPONENT",
      comp: { id: "x", type: "led-red", x: 32, y: 32, rotation: 0 },
    });
    expect(next.circuit.comps.find(c => c.id === "x")).toBeTruthy();
  });

  it("MOVE_COMPONENT updates coords", () => {
    const init = initCADState({
      comps: [{ id: "x", type: "led-red", x: 0, y: 0, rotation: 0 }],
      wires: [],
    });
    const next = cadReducer(init, { type: "MOVE_COMPONENT", id: "x", x: 64, y: 48 });
    expect(next.circuit.comps[0]).toMatchObject({ x: 64, y: 48 });
  });

  it("DELETE_COMPONENT removes component AND its wires", () => {
    const init = initCADState({
      comps: [
        { id: "a", type: "led-red", x: 0, y: 0, rotation: 0 },
        { id: "b", type: "resistor-220", x: 0, y: 0, rotation: 0 },
      ],
      wires: [{ id: "w1", from: { compId: "a", pinName: "anode" }, to: { compId: "b", pinName: "a" } }],
    });
    const next = cadReducer(init, { type: "DELETE_COMPONENT", id: "a" });
    expect(next.circuit.comps).toHaveLength(1);
    expect(next.circuit.wires).toHaveLength(0);
  });

  it("ADD_WIRE appends; CANCEL_WIRE clears in-progress", () => {
    let s = initCADState(createDefaultCircuit());
    s = cadReducer(s, { type: "BEGIN_WIRE", from: { compId: "x", pinName: "p1" } });
    expect(s.wireInProgress).toEqual({ compId: "x", pinName: "p1" });
    s = cadReducer(s, { type: "CANCEL_WIRE" });
    expect(s.wireInProgress).toBeNull();
  });

  it("SELECT clears previous selection", () => {
    let s = initCADState(createDefaultCircuit());
    s = cadReducer(s, { type: "SELECT", target: { kind: "component", id: "x" } });
    expect(s.selection).toEqual({ kind: "component", id: "x" });
    s = cadReducer(s, { type: "SELECT", target: null });
    expect(s.selection).toBeNull();
  });
});
```

Run: `npm test -- useCADReducer`
Expected: FAIL.

- [ ] **Step 2: Implement the reducer**

```ts
// src/components/cad/hooks/useCADReducer.ts
import { useReducer } from "react";
import type { Circuit, CircuitComponent, PinRef, Wire } from "@/types/cad";

export type Selection =
  | { kind: "component"; id: string }
  | { kind: "wire"; id: string }
  | null;

export interface CADState {
  circuit: Circuit;
  selection: Selection;
  wireInProgress: PinRef | null;
  cursorPlane: { x: number; y: number } | null;   // for in-progress wire preview
  zoom: number;
  pan: { x: number; y: number };
}

export type CADAction =
  | { type: "PLACE_COMPONENT"; comp: CircuitComponent }
  | { type: "MOVE_COMPONENT"; id: string; x: number; y: number }
  | { type: "DELETE_COMPONENT"; id: string }
  | { type: "BEGIN_WIRE"; from: PinRef }
  | { type: "FINISH_WIRE"; to: PinRef }
  | { type: "CANCEL_WIRE" }
  | { type: "DELETE_WIRE"; id: string }
  | { type: "SELECT"; target: Selection }
  | { type: "SET_CURSOR"; pos: { x: number; y: number } | null }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_PAN"; pan: { x: number; y: number } }
  | { type: "RESET_CIRCUIT"; circuit: Circuit };

export function initCADState(circuit: Circuit): CADState {
  return {
    circuit,
    selection: null,
    wireInProgress: null,
    cursorPlane: null,
    zoom: 1,
    pan: { x: 0, y: 0 },
  };
}

export function cadReducer(state: CADState, action: CADAction): CADState {
  switch (action.type) {
    case "PLACE_COMPONENT":
      return { ...state, circuit: { ...state.circuit, comps: [...state.circuit.comps, action.comp] } };

    case "MOVE_COMPONENT":
      return {
        ...state,
        circuit: {
          ...state.circuit,
          comps: state.circuit.comps.map(c =>
            c.id === action.id ? { ...c, x: action.x, y: action.y } : c,
          ),
        },
      };

    case "DELETE_COMPONENT": {
      const comps = state.circuit.comps.filter(c => c.id !== action.id);
      const wires = state.circuit.wires.filter(
        w => w.from.compId !== action.id && w.to.compId !== action.id,
      );
      return {
        ...state,
        circuit: { comps, wires },
        selection: state.selection?.kind === "component" && state.selection.id === action.id
          ? null : state.selection,
      };
    }

    case "BEGIN_WIRE":
      return { ...state, wireInProgress: action.from };

    case "FINISH_WIRE": {
      if (!state.wireInProgress) return state;
      const wire: Wire = {
        id: crypto.randomUUID(),
        from: state.wireInProgress,
        to: action.to,
      };
      return {
        ...state,
        circuit: { ...state.circuit, wires: [...state.circuit.wires, wire] },
        wireInProgress: null,
        cursorPlane: null,
      };
    }

    case "CANCEL_WIRE":
      return { ...state, wireInProgress: null, cursorPlane: null };

    case "DELETE_WIRE":
      return {
        ...state,
        circuit: { ...state.circuit, wires: state.circuit.wires.filter(w => w.id !== action.id) },
        selection: state.selection?.kind === "wire" && state.selection.id === action.id
          ? null : state.selection,
      };

    case "SELECT":
      return { ...state, selection: action.target };

    case "SET_CURSOR":
      return { ...state, cursorPlane: action.pos };

    case "SET_ZOOM":
      return { ...state, zoom: action.zoom };

    case "SET_PAN":
      return { ...state, pan: action.pan };

    case "RESET_CIRCUIT":
      return initCADState(action.circuit);

    default:
      return state;
  }
}

export function useCADReducer(initial: Circuit) {
  return useReducer(cadReducer, initial, initCADState);
}
```

Run: `npm test -- useCADReducer`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/cad/hooks/useCADReducer.ts src/components/cad/hooks/__tests__/useCADReducer.test.ts
git commit -m "feat(cad): useCADReducer local state machine + tests"
```

---

## Task 18: CADWorkspace shell with debounced sync

**Files:**
- Create: `src/components/cad/CADWorkspace.tsx`

- [ ] **Step 1: Write the shell**

```tsx
// src/components/cad/CADWorkspace.tsx
"use client";
import { useEffect, useRef } from "react";
import { useCADReducer } from "./hooks/useCADReducer";
import { Plane } from "./Plane";
import { Palette } from "./Palette";
import { TopBar } from "./TopBar";
import { ZoomControls } from "./ZoomControls";
import { WireLayer } from "./WireLayer";
import { SAVE_DEBOUNCE_MS } from "@/lib/cad/constants";
import type { Circuit, ComponentType } from "@/types/cad";

interface Props {
  taskId: string;
  taskTitle: string;
  initialCircuit: Circuit;
  palette: ComponentType[];
  onSave: (c: Circuit) => void;
  onClose: () => void;
  onReset: () => void;
  readOnly?: boolean;                          // true when adminPreviewActive
}

export function CADWorkspace({
  taskId, taskTitle, initialCircuit, palette, onSave, onClose, onReset, readOnly,
}: Props) {
  const [state, dispatch] = useCADReducer(initialCircuit);
  const planeRef = useRef<HTMLDivElement>(null);
  const lastSyncedRef = useRef<Circuit>(initialCircuit);

  // Debounced sync to GameState
  useEffect(() => {
    if (readOnly) return;
    if (state.circuit === lastSyncedRef.current) return;
    const handle = setTimeout(() => {
      onSave(state.circuit);
      lastSyncedRef.current = state.circuit;
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [state.circuit, onSave, readOnly]);

  // Keyboard: Esc cancels in-progress wire OR closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (state.wireInProgress) dispatch({ type: "CANCEL_WIRE" });
        else onClose();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && state.selection && !readOnly) {
        if (state.selection.kind === "component") {
          dispatch({ type: "DELETE_COMPONENT", id: state.selection.id });
        } else if (state.selection.kind === "wire") {
          dispatch({ type: "DELETE_WIRE", id: state.selection.id });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.wireInProgress, state.selection, onClose, readOnly]);

  return (
    <div className="flex h-full w-full flex-col bg-[color:var(--theme-bg)]">
      <TopBar taskTitle={taskTitle} onClose={onClose} onReset={onReset} readOnly={readOnly} />
      <div className="flex flex-1 overflow-hidden">
        <Palette palette={palette} disabled={readOnly} />
        <div className="relative flex-1 overflow-hidden">
          <Plane ref={planeRef} state={state} dispatch={dispatch} readOnly={readOnly} />
          <WireLayer planeRef={planeRef} state={state} dispatch={dispatch} />
          <ZoomControls zoom={state.zoom} dispatch={dispatch} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit (this won't compile until child components exist — accept for now)**

```bash
git add src/components/cad/CADWorkspace.tsx
git commit -m "feat(cad): CADWorkspace shell with debounced sync + keyboard handlers"
```

---

## Task 19: CADModal (lazy-loaded fullscreen wrapper)

**Files:**
- Create: `src/components/cad/CADModal.tsx`

- [ ] **Step 1: Write the modal**

```tsx
// src/components/cad/CADModal.tsx
"use client";
import { useEffect } from "react";
import { useGameState } from "@/components/providers/GameStateProvider";
import { CADWorkspace } from "./CADWorkspace";
import { applyTaskSeed, createDefaultCircuit } from "@/lib/cad/circuit";
import { getTaskById } from "@/lib/tasks";

interface Props {
  taskId: string;
  open: boolean;
  onClose: () => void;
}

export default function CADModal({ taskId, open, onClose }: Props) {
  const { state, dispatch } = useGameState();
  const task = getTaskById(taskId);

  // Side-load wokwi/elements once when modal opens
  useEffect(() => {
    if (!open) return;
    void import("@wokwi/elements");
  }, [open]);

  if (!open || !task || !task.cad) return null;

  const initialCircuit = state.circuits[taskId] ?? applyTaskSeed(task);
  const palette = task.cad.palette;

  return (
    <div className="fixed inset-0 z-[60] bg-black/95">
      <CADWorkspace
        taskId={taskId}
        taskTitle={task.title}
        initialCircuit={initialCircuit}
        palette={palette}
        readOnly={state.adminPreviewActive}
        onSave={(circuit) => dispatch({ type: "SAVE_CIRCUIT", taskId, circuit })}
        onReset={() => {
          if (confirm("Resetovat obvod do výchozího stavu?")) {
            const fresh = applyTaskSeed(task);
            dispatch({ type: "SAVE_CIRCUIT", taskId, circuit: fresh });
          }
        }}
        onClose={onClose}
      />
    </div>
  );
}
```

Verify `getTaskById` exists in `src/lib/tasks.ts`. If not, add a small helper:

```ts
// src/lib/tasks.ts (append near bottom)
export function getTaskById(id: string): Task | undefined {
  return getAllTasks().find(t => t.id === id);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cad/CADModal.tsx src/lib/tasks.ts
git commit -m "feat(cad): CADModal lazy-loaded fullscreen wrapper + admin-preview readOnly"
```

---

# Phase 6 — Plane & pan/zoom

## Task 20: usePanZoom hook

**Files:**
- Create: `src/components/cad/hooks/usePanZoom.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/components/cad/hooks/usePanZoom.ts
import { useCallback, useEffect, useRef } from "react";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "@/lib/cad/constants";
import type { CADAction, CADState } from "./useCADReducer";

/**
 * Wires mouse-wheel zoom and middle-click drag pan onto a container.
 * Empty-area left-click + drag also pans (handled by Plane).
 */
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
    if (e.button !== 1) return;            // middle button only
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cad/hooks/usePanZoom.ts
git commit -m "feat(cad): usePanZoom hook (wheel zoom + middle-click pan)"
```

---

## Task 21: Plane component

**Files:**
- Create: `src/components/cad/Plane.tsx`

- [ ] **Step 1: Write the plane**

```tsx
// src/components/cad/Plane.tsx
"use client";
import { forwardRef } from "react";
import { PlacedComponent } from "./PlacedComponent";
import { usePanZoom } from "./hooks/usePanZoom";
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
  // ref param is the inner #workspace-plane (drives pin coord math)
  const containerRef = (ref as React.RefObject<HTMLDivElement>) ?? null;
  const panZoom = usePanZoom(containerRef, state, dispatch);

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
        style={{
          width: 4000, height: 4000,
          left: 2000, top: 2000,                 // give negative coords room
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cad/Plane.tsx
git commit -m "feat(cad): Plane with grid background + pan/zoom transform"
```

---

# Phase 7 — Component rendering & palette

## Task 22: PlacedComponent

**Files:**
- Create: `src/components/cad/PlacedComponent.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/cad/PlacedComponent.tsx
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
      // raw drag without snap (snap on mouseup); approximate
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
    // FINISH_WIRE handled by WireLayer when second pin is clicked
  }, [comp.id, dispatch, readOnly]);

  // Render the wokwi tag — using React.createElement to allow hyphenated tag name
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
      {/* native wokwi visual */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Wokwi {...(wokwiAttrs as any)} />

      {/* pin overlay hit-areas (outside shadow DOM) */}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cad/PlacedComponent.tsx
git commit -m "feat(cad): PlacedComponent with drag, pin hit-areas, selection"
```

---

## Task 23: PaletteCard + Palette + drag-from-palette

**Files:**
- Create: `src/components/cad/PaletteCard.tsx`
- Create: `src/components/cad/Palette.tsx`
- Create: `src/components/cad/hooks/useDragDrop.ts`

- [ ] **Step 1: Write `useDragDrop`**

```ts
// src/components/cad/hooks/useDragDrop.ts
import { useCallback } from "react";
import { snapToGrid } from "@/lib/cad/circuit";
import type { ComponentType } from "@/types/cad";
import type { CADAction } from "./useCADReducer";

const DRAG_MIME = "application/x-cad-component";

export function usePaletteDragSource() {
  const onDragStart = useCallback((e: React.DragEvent, type: ComponentType) => {
    e.dataTransfer.setData(DRAG_MIME, type);
    e.dataTransfer.effectAllowed = "copy";
  }, []);
  return { onDragStart };
}

export function usePlaneDropTarget(
  planeRef: React.RefObject<HTMLDivElement>,
  dispatch: React.Dispatch<CADAction>,
) {
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    const type = e.dataTransfer.getData(DRAG_MIME) as ComponentType | "";
    if (!type) return;
    e.preventDefault();
    const plane = planeRef.current;
    if (!plane) return;
    const rect = plane.getBoundingClientRect();
    // (e.clientX - rect.left) is in client px; account for plane transform via inverse?
    // We mounted the plane with its own transform; the dataset is plane-local px.
    // For simplicity, drop snaps to the unscaled local coordinate system.
    const x = snapToGrid(e.clientX - rect.left);
    const y = snapToGrid(e.clientY - rect.top);
    dispatch({
      type: "PLACE_COMPONENT",
      comp: { id: crypto.randomUUID(), type, x, y, rotation: 0 },
    });
  }, [planeRef, dispatch]);

  return { onDragOver, onDrop };
}
```

- [ ] **Step 2: Write `PaletteCard`**

```tsx
// src/components/cad/PaletteCard.tsx
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
```

- [ ] **Step 3: Write `Palette`**

```tsx
// src/components/cad/Palette.tsx
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
```

- [ ] **Step 4: Wire drop target into Plane**

In `src/components/cad/Plane.tsx`, import and apply `usePlaneDropTarget`:

```ts
import { usePlaneDropTarget } from "./hooks/useDragDrop";
// inside component:
const innerRef = ref as React.RefObject<HTMLDivElement>;
const dropProps = usePlaneDropTarget(innerRef, dispatch);
```

Add `onDragOver={dropProps.onDragOver} onDrop={dropProps.onDrop}` to the inner `#workspace-plane` div.

- [ ] **Step 5: Add palette icon placeholders**

Create `public/cad/palette/` directory. For now, drop in 10 placeholder PNGs (use simple text-on-square images or solid color squares — Štěpán can replace with proper icons later). 80×80 each. File names match `paletteIcon` in registry.

```bash
mkdir -p public/cad/palette
# generate placeholder files with 80×80 PNGs (e.g. via ImageMagick or commit blank squares)
```

If image generation is non-trivial in this environment, commit empty placeholder PNGs and add a TODO comment in `components.ts`. Štěpán will swap in real icons.

- [ ] **Step 6: Commit**

```bash
git add src/components/cad/Palette.tsx src/components/cad/PaletteCard.tsx \
        src/components/cad/hooks/useDragDrop.ts src/components/cad/Plane.tsx \
        public/cad/palette/
git commit -m "feat(cad): Palette + drag-from-palette drop target"
```

---

# Phase 8 — Wire drawing

## Task 24: useWiring hook + WirePath + WireLayer

**Files:**
- Create: `src/components/cad/hooks/useWiring.ts`
- Create: `src/components/cad/WirePath.tsx`
- Create: `src/components/cad/WireLayer.tsx`

- [ ] **Step 1: Write `useWiring`**

```ts
// src/components/cad/hooks/useWiring.ts
import { useCallback } from "react";
import type { PinRef } from "@/types/cad";
import type { CADAction } from "./useCADReducer";

export function useWiring(dispatch: React.Dispatch<CADAction>) {
  const onPinClick = useCallback((pin: PinRef, inProgressFrom: PinRef | null) => {
    if (!inProgressFrom) {
      dispatch({ type: "BEGIN_WIRE", from: pin });
      return;
    }
    if (inProgressFrom.compId === pin.compId && inProgressFrom.pinName === pin.pinName) {
      dispatch({ type: "CANCEL_WIRE" });
      return;
    }
    dispatch({ type: "FINISH_WIRE", to: pin });
  }, [dispatch]);

  return { onPinClick };
}
```

(Note: `PlacedComponent` already dispatches `BEGIN_WIRE` directly. Refactor to use this hook so the second-click path works correctly.)

- [ ] **Step 2: Refactor `PlacedComponent.onPinClick` to delegate**

In `PlacedComponent.tsx`, replace the inline `onPinClick` body with delegation. To avoid passing `wireInProgress` deeply, route the click through a shared handler. Easiest: read state via React context. Pragmatic option: pass `wireInProgress` and `onPinAction` as props from `Plane` → `PlacedComponent`.

Adjust `Plane`:
```tsx
import { useWiring } from "./hooks/useWiring";
// inside component:
const wiring = useWiring(dispatch);
// pass to PlacedComponent:
<PlacedComponent ... wireInProgress={state.wireInProgress} onPinAction={(pin) => wiring.onPinClick(pin, state.wireInProgress)} />
```

Adjust `PlacedComponent` props:
```ts
interface Props {
  comp: CircuitComponent;
  selected: boolean;
  dispatch: React.Dispatch<CADAction>;
  wireInProgress: PinRef | null;
  onPinAction: (pin: PinRef) => void;
  readOnly?: boolean;
}
```

Replace `onPinClick` body with `onPinAction({ compId: comp.id, pinName })`.

- [ ] **Step 3: Write `WirePath`**

```tsx
// src/components/cad/WirePath.tsx
import { WIRE_COLOR_DEFAULT, WIRE_COLOR_SELECTED, WIRE_STROKE_WIDTH } from "@/lib/cad/constants";

interface Props {
  fromX: number; fromY: number;
  toX: number;   toY: number;
  selected?: boolean;
  onClick?: () => void;
}

export function WirePath({ fromX, fromY, toX, toY, selected, onClick }: Props) {
  const d = `M ${fromX} ${fromY} L ${toX} ${toY}`;
  return (
    <path
      d={d}
      stroke={selected ? WIRE_COLOR_SELECTED : WIRE_COLOR_DEFAULT}
      strokeWidth={WIRE_STROKE_WIDTH}
      fill="none"
      strokeLinecap="round"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", pointerEvents: "stroke" }}
    />
  );
}
```

- [ ] **Step 4: Write `WireLayer`**

```tsx
// src/components/cad/WireLayer.tsx
"use client";
import { useEffect, useState } from "react";
import { WirePath } from "./WirePath";
import { usePinPositions } from "./hooks/usePinPositions";
import { WIRE_COLOR_DRAFT, WIRE_STROKE_WIDTH } from "@/lib/cad/constants";
import type { CADAction, CADState } from "./hooks/useCADReducer";

interface Props {
  planeRef: React.RefObject<HTMLDivElement>;
  state: CADState;
  dispatch: React.Dispatch<CADAction>;
}

export function WireLayer({ planeRef, state, dispatch }: Props) {
  const { getPin, invalidateAll } = usePinPositions(planeRef);
  const [tick, setTick] = useState(0);

  // Re-resolve pins after every render — caller invalidates when needed.
  // We force a re-render once after mount to give shadow DOM time to populate.
  useEffect(() => {
    const id = requestAnimationFrame(() => setTick(t => t + 1));
    return () => cancelAnimationFrame(id);
  }, [state.circuit.comps.length, state.zoom, state.pan]);

  // Invalidate cache when components move
  useEffect(() => {
    invalidateAll();
  }, [state.circuit.comps, state.zoom, state.pan, invalidateAll]);

  const resolveWireEnds = (compId: string, pinName: string) => {
    const comp = state.circuit.comps.find(c => c.id === compId);
    if (!comp) return null;
    const compEl = document.querySelector(`[data-comp-id="${compId}"]`) as HTMLElement | null;
    if (!compEl) return null;
    return getPin(compId, pinName, compEl, comp.type);
  };

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 10 }}
      data-tick={tick}
    >
      {state.circuit.wires.map(w => {
        const f = resolveWireEnds(w.from.compId, w.from.pinName);
        const t = resolveWireEnds(w.to.compId,   w.to.pinName);
        if (!f || !t) return null;
        return (
          <WirePath
            key={w.id}
            fromX={f.x} fromY={f.y} toX={t.x} toY={t.y}
            selected={state.selection?.kind === "wire" && state.selection.id === w.id}
            onClick={() => dispatch({ type: "SELECT", target: { kind: "wire", id: w.id } })}
          />
        );
      })}

      {/* in-progress wire follows cursor */}
      {state.wireInProgress && state.cursorPlane && (() => {
        const f = resolveWireEnds(state.wireInProgress.compId, state.wireInProgress.pinName);
        if (!f) return null;
        return (
          <path
            d={`M ${f.x} ${f.y} L ${state.cursorPlane.x} ${state.cursorPlane.y}`}
            stroke={WIRE_COLOR_DRAFT} strokeWidth={WIRE_STROKE_WIDTH}
            fill="none" strokeDasharray="4 4"
          />
        );
      })()}
    </svg>
  );
}
```

- [ ] **Step 5: Wire cursor tracking into Plane**

In `Plane.tsx`, add `onMouseMove` that dispatches `SET_CURSOR` when `state.wireInProgress` is set, mapping client coords to plane local coords. (Wrap into existing `panZoom.onMouseMove` callback, fall through to cursor update.)

- [ ] **Step 6: Commit**

```bash
git add src/components/cad/hooks/useWiring.ts src/components/cad/WirePath.tsx \
        src/components/cad/WireLayer.tsx src/components/cad/PlacedComponent.tsx \
        src/components/cad/Plane.tsx
git commit -m "feat(cad): wire drawing — click pin → click pin, in-progress preview"
```

---

# Phase 9 — Top bar & zoom controls

## Task 25: TopBar

**Files:**
- Create: `src/components/cad/TopBar.tsx`

- [ ] **Step 1: Write the bar**

```tsx
// src/components/cad/TopBar.tsx
"use client";
import { ArrowLeft, RotateCcw } from "lucide-react";

interface Props {
  taskTitle: string;
  onClose: () => void;
  onReset: () => void;
  readOnly?: boolean;
}

export function TopBar({ taskTitle, onClose, onReset, readOnly }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-2">
      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm hover:border-white/30"
      >
        <ArrowLeft className="h-4 w-4" /> Zpět
      </button>
      <h1 className="text-sm font-medium text-white/90">
        {taskTitle}
        {readOnly && <span className="ml-2 text-xs text-amber-400">(jen čtení — admin preview)</span>}
      </h1>
      <button
        type="button"
        onClick={onReset}
        disabled={readOnly}
        className="flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm hover:border-red-500/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw className="h-4 w-4" /> Reset
      </button>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cad/TopBar.tsx
git commit -m "feat(cad): TopBar (close, title, reset)"
```

---

## Task 26: ZoomControls

**Files:**
- Create: `src/components/cad/ZoomControls.tsx`

- [ ] **Step 1: Write the controls**

```tsx
// src/components/cad/ZoomControls.tsx
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
      <button onClick={() => { dispatch({ type: "SET_ZOOM", zoom: ZOOM_DEFAULT }); dispatch({ type: "SET_PAN", pan: { x: 0, y: 0 } }); }}
              className="rounded p-1 hover:bg-white/10" aria-label="Reset zoom">
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cad/ZoomControls.tsx
git commit -m "feat(cad): ZoomControls (+/− and reset-to-fit)"
```

---

# Phase 10 — TaskDetail integration

## Task 27: Add CAD entry button to TaskDetail

**Files:**
- Modify: `src/components/screens/TaskDetail.tsx`

- [ ] **Step 1: Lazy import CADModal and add state**

At top of `TaskDetail.tsx`:

```tsx
import dynamic from "next/dynamic";
const CADModal = dynamic(() => import("@/components/cad/CADModal"), { ssr: false });
```

In the component body (where `task` is available):

```tsx
const [cadOpen, setCadOpen] = useState(false);
```

- [ ] **Step 2: Render the button when `task.cad` is defined**

After the existing wiring text-hint section (find the section showing `task.hints.wiring`):

```tsx
{task.cad && (
  <div className="mt-3 rounded-lg border border-white/15 bg-white/5 p-3">
    <button
      type="button"
      onClick={() => setCadOpen(true)}
      className="flex items-center gap-2 rounded-md bg-[color:var(--theme-accent)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
    >
      <span>▶</span> Postavit obvod
    </button>
    <p className="mt-2 text-xs text-white/60">
      Otevře vizuální editor obvodu. Tvůj postup se uloží automaticky.
    </p>
  </div>
)}

<CADModal taskId={task.id} open={cadOpen} onClose={() => setCadOpen(false)} />
```

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
# log in, open beginner-led task → "Postavit obvod" button should appear
# click → fullscreen CAD modal opens with palette and pre-seeded Arduino + breadboard
# Esc closes modal
```

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/TaskDetail.tsx
git commit -m "feat(cad): integrate CAD entry button into TaskDetail"
```

---

# Phase 11 — End-to-end validation

## Task 28: Manual E2E checklist

**Files:** none (validation only)

- [ ] **Step 1: Run through the spec's "Done" criteria**

For each item below, verify in browser:

1. [ ] Open `beginner-led` → "Postavit obvod" button visible
2. [ ] Click → fullscreen CAD opens with Arduino + breadboard pre-seeded
3. [ ] Palette shows exactly: LED červená, Rezistor 220 Ω, Tlačítko (3 cards)
4. [ ] Drag LED from palette → drop on plane → LED appears, snapped to PITCH grid
5. [ ] Drag resistor → places, spans 4×PITCH (5 holes equivalent)
6. [ ] Drag pushbutton → places, spans 2×2 PITCH
7. [ ] Hover pin on LED → hit-area highlights
8. [ ] Click LED anode → click Arduino D13 → wire drawn between them
9. [ ] Esc cancels in-progress wire
10. [ ] Click placed component → outline, Delete removes it (and its wires)
11. [ ] Wheel zoom in/out works; +/− buttons work; reset-to-fit works
12. [ ] Middle-click drag pans plane
13. [ ] Close modal (Esc or ← Zpět) → state persists in `state.circuits[taskId]`
14. [ ] Re-open CAD → previous circuit visible
15. [ ] Reset button → confirm → workspace returns to seed (Arduino + breadboard only)
16. [ ] Switch student (LOGIN_STUDENT to different number) → circuits scope to per-student
17. [ ] Login Supabase user → DevTools Network → see `learning_accounts.state.circuits` synced
18. [ ] Log in on second device with same Supabase user → circuit appears
19. [ ] Admin preview mode (`adminPreviewActive=true`) → CAD opens read-only, palette disabled, Reset disabled
20. [ ] Original code-textarea + "Zkontrolovat" reward flow unchanged — kid still earns 5⭐ via code regex

- [ ] **Step 2: Performance smoke**

Place 10 components + 15 wires. Drag a component around. FPS should stay > 30. If lower, profile and consider:
- Memoize `PlacedComponent` (`React.memo`)
- Throttle `MOVE_COMPONENT` dispatch (via `requestAnimationFrame`)
- Add `WireLayer` memoization

- [ ] **Step 3: Bundle audit**

```bash
npm run build
```

Confirm the lazy chunk that contains wokwi/elements is < 200 kB gzipped. If exceeded, Phase B will revisit.

- [ ] **Step 4: Run all unit tests**

```bash
npm test
```

Expected: all passing.

- [ ] **Step 5: Commit final fixups (if any)**

```bash
# If bug fixes were needed during E2E
git add -p
git commit -m "fix(cad): adjustments from manual E2E pass"
```

---

# Implementation notes for the executing engineer

## Order of execution

Tasks 1–4 are prerequisites and gate everything else. Do not skip them. After Task 4, tasks within each Phase are mostly independent within their grouping; cross-phase dependencies follow the order written.

## TDD discipline

For each task that includes tests (Tasks 7, 8, 17): **write test → confirm fail → implement → confirm pass**. Don't skip the "confirm fail" step — it ensures the test actually exercises the code under test.

## Frequent commits

Commit at every "Commit" step. Don't bundle multiple tasks into one commit. The plan's commit cadence is intentional — each commit produces a working, mergeable state, even if the feature is not yet visible in the UI.

## Style consistency

Match existing codebase conventions:
- Czech UI text, English code/comments
- Tailwind classes preferred over CSS modules
- `lucide-react` icons
- `@/...` path aliases
- Functional components, no classes
- `"use client"` directive for any component using browser APIs

## When something doesn't fit the plan

If during implementation you discover the plan is wrong (e.g., wokwi pin layout differs significantly from the registry estimate), **stop and surface to the user**. Do not improvise large structural changes silently.

## Out of scope reminders

These are explicitly NOT in this plan and must NOT be added during execution:

- Simulation (no AVR8js, no runtime)
- Blockly editor
- Validation against a reference circuit
- Mobile/touch support
- Multi-select / undo / rotation UI / wire colors

If a tempting tangent presents itself, write it down for Phase B/C and keep moving.
