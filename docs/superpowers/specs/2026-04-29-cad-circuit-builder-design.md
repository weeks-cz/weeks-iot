# CAD Circuit Builder — Phase A design

> Spec pro brainstorm z 2026-04-29. Schváleno uživatelem před přechodem do writing-plans.
> Autor: Lukáš + Štěpán (architecture brief) + Claude (brainstorm session).

---

## Kontext a cíl

Weeks-iot je výuková platforma s 31 Arduino úkoly. Současný flow: kid přečte text-hint pro zapojení, napíše Arduino kód do textarey, regex validátor odměnu udělí. Žádný vizuální obvod, žádná simulace.

Cíl projektu — **Tinkercad-like CAD s Arduino simulací a Blockly editorem v prohlížeči, integrovaný do weeks-iot**. Štěpán předtím zkoušel implementaci přes Codex; zahodil ji a předal architecture brief pro restart.

Protože jde o velký vícevrstvý systém (Tinkercad Circuits má za sebou 10+ let inženýrské práce), rozdělujeme na tři sub-projekty, které se implementují sekvenčně:

| Sub-projekt | Obsah |
|---|---|
| **A — Circuit Builder** (tento spec) | Statický builder: drag komponent, breadboard, kreslení drátů, persist. **Žádná simulace, žádný Blockly.** |
| B — Simulation Layer | AVR8js běží Arduino kód, propaguje signály po drátech, LED svítí, tlačítka generují eventy. |
| C — Blockly Code Editor | Bloky ↔ text bidirectional sync, integrace do simulace + validace úkolu. |

**Tento dokument popisuje pouze Phase A.** Phase B a C dostanou vlastní brainstorm → spec → plán cykly poté co je A funkční.

### Cíl Phase A

- Kid v detailu úkolu klikne "Postavit obvod" → otevře se fullscreen CAD modal.
- Workspace má pre-seeded breadboard + Arduino. V levém sidebaru palette s task-relevantními komponentami.
- Kid přetahuje komponenty z palette na plane, snapuje na PITCH grid, kreslí dráty mezi piny.
- Stav obvodu se auto-saves do `state.circuits[taskId]`, persistuje localStorage + cloud-sync.
- Reward flow zůstane neměněn — code regex stále určuje 5⭐, CAD je čistě additivní.

### Co Phase A explicitně NEDĚLÁ

- ❌ Simulace (žádný AVR8js, žádný runtime kód)
- ❌ Změny code editoru (textarea zůstává; Blockly = Phase C)
- ❌ Validace obvodu vs. reference circuit
- ❌ Mobile/touch support (desktop only, mobile vidí původní text-hint flow)
- ❌ Sandbox / Volný režim (jen per-task workspace)
- ❌ Multi-select, kopírování, undo/redo
- ❌ UI rotace komponent (datový field existuje pro forward-compat)
- ❌ Wire color picker (jednotná barva)
- ❌ Component property editor (např. změna LED barvy z menu — jiný typ = jiná komponenta)

---

## Architektonické principy

Štěpán předal striktní engine rules, které Phase A přijímá beze změny:

1. **Pure data-driven CAD plane.** UI je striktně driven by state `{ comps, wires }`. Žádný flexbox/grid pro layout komponent. Single infinite plane `<div id="workspace-plane">`. Pan & zoom přes `transform: scale(z) translate(x,y)` na plane. Background grid pattern scale-uje smoothly. Všechny komponenty uvnitř plane jsou `position: absolute; left: {x}px; top: {y}px;`.

2. **PITCH konstanta.** `PITCH = 16px` (standardní vzdálenost mezi středy děr breadboardu při current scale). Všechny drag&drop akce snap na grid v `dragEnd`: `newX = Math.round(rawX / PITCH) * PITCH`.

3. **Native breadboard physics.** Použít `<wokwi-breadboard-half>`. Nekreslit vlastní breadboard. Trench (mezera mezi řádky E a F) = `1.0 * PITCH`. LED nohy span = `1.0 * PITCH`. Resistor span = `4.0 * PITCH` (5 děr). Pushbutton = `2.0 * PITCH` vertically (straddles trench E↔F).

4. **Immutable native visuals.** Neaplikovat `width/height/background/custom SVG` na `<wokwi-*>` elementy. Šadow DOM render at intrinsic size. Pro fitting na PITCH grid jen `transform: scale(X)` na absolute wrapperu.

5. **Wiring engine.** Všechny dráty v jednom SVG overlay layer (`pointer-events: none; position: absolute; inset: 0; z-index: 10`). Wires = SVG `<path>` elementy. Pro snap drátu na pin **musíme pierce shadow DOM** — `comp.shadowRoot.querySelector('.pin-13')`, získat `getBoundingClientRect()`, vypočítat pixel center, namapovat do `#workspace-plane` souřadnic. Nikdy nedefaultovat na (0,0) komponenty.

### Integrace s aplikací — Hybrid Approach

CAD má interní lokální stav (`useReducer`) pro real-time interakce (drag/hover/wire-in-progress). **Debounced sync** (200ms) do GameState po dokončení akce. Persistence proteče existujícím GameState/cloud-sync — engine zůstane modulární a self-contained.

```
User akce v CAD (drop, drag, wire, delete)
    ↓
useCADReducer dispatch (instant UI update, 60fps)
    ↓ debounce 200ms (po dokončení akce)
useEffect → onSave(localCircuit)
    ↓
GameStateProvider dispatch SAVE_CIRCUIT { taskId, circuit }
    ↓
state.circuits[taskId] = circuit
    ↓ (existing flow, unchanged)
saveGameState(state) → localStorage
syncToCloud(state) → Supabase (pokud linkedUserId)
```

---

## Data model

```ts
// src/types/cad.ts

export type ComponentType =
  | 'arduino-uno' | 'breadboard-half'
  | 'led-red' | 'led-yellow' | 'led-green' | 'led-blue' | 'led-rgb'
  | 'resistor-220' | 'pushbutton' | 'piezo-buzzer'
  | 'potentiometer' | 'photoresistor';

export interface CircuitComponent {
  id: string;             // uuid
  type: ComponentType;
  x: number;              // PITCH-aligned coords on plane
  y: number;
  rotation: 0 | 90 | 180 | 270;  // v1: vždy 0; field reserved pro forward-compat
}

export interface PinRef {
  compId: string;         // CircuitComponent.id
  pinName: string;        // 'D13' / 'GND' / 'row-A-15' / 'anode' / 'cathode' / atd.
}

export interface Wire {
  id: string;             // uuid
  from: PinRef;
  to: PinRef;
  // pixel path NEPERSISTUJEME — počítá se při render time z pin pozic
  color?: 'gray';         // v1 jen 'gray'; reserved pro Phase B+
}

export interface Circuit {
  comps: CircuitComponent[];
  wires: Wire[];
  // pan/zoom NEPERSISTUJEME — workspace se vždy otevře vystředěný na obvod
}
```

### Klíčové designové rozhodnutí: logical pins, ne pixely

`Wire.from/to` ukazuje na **logický pin** (např. `'D13'` na Arduinu, `'row-15-c'` na breadboardu). Pixel pozice se vypočítají při render time přes Štěpánovu shadow-DOM-piercing techniku. Tím obvod survive resize, zoom a future scale changes — uložený obvod bude validní i kdybychom změnili PITCH.

### Per-task konfigurace

Existující `Task` typ rozšíříme o volitelné `cad` pole:

```ts
// src/types/index.ts (rozšíření)
export interface Task {
  // ...existing fields
  cad?: {
    palette: ComponentType[];      // jen tyto komponenty se zobrazí v palette
    seed?: CircuitComponent[];     // volitelný custom seed; jinak default
  };
}
```

**Entry point podmínka:** "Postavit obvod" button v TaskDetail se zobrazí **pouze pokud `task.cad !== undefined`**. Úkoly bez `cad` pole nemají CAD entry — kid vidí jen text-hinty (existující flow). Tím můžeme postupně přidávat CAD do dalších úkolů bez "all-or-nothing" rolloutu.

**Default seed** (pro úkoly bez `cad.seed`):

```ts
const DEFAULT_SEED: CircuitComponent[] = [
  { id: 'arduino-default',    type: 'arduino-uno',     x: 0,    y: 0, rotation: 0 },
  { id: 'breadboard-default', type: 'breadboard-half', x: 240,  y: 0, rotation: 0 },
];
```

**Phase A scope:** definujeme `cad.palette` pro prvních 8 beginner úkolů. Žádný custom `cad.seed` — default scaffolding stačí.

| Úkol | palette |
|---|---|
| `beginner-led` | led-red, resistor-220, pushbutton |
| `beginner-buzzer-button` | piezo-buzzer, pushbutton |
| `beginner-potentiometer` | potentiometer, led-red, resistor-220 |
| `beginner-pwm-led` | led-red, resistor-220 |
| `beginner-traffic-light` | led-red, led-yellow, led-green, resistor-220 |
| `beginner-light-sensor` | photoresistor, led-red, resistor-220 |
| `beginner-and-or` | led-red, resistor-220, pushbutton |
| `beginner-rgb-button` | led-rgb, resistor-220, pushbutton |

Drát **není v paletě** — kreslí se klikem mezi piny (Tinkercad model).

### Component registry

Každý ComponentType má declarative spec:

```ts
// src/lib/cad/components.ts
export interface ComponentSpec {
  type: ComponentType;
  label: string;                       // "LED červená"
  wokwiTag: string;                    // 'wokwi-led', 'wokwi-resistor', …
  wokwiAttrs?: Record<string, string>; // { color: 'red' } pro LED
  pins: PinSpec[];                     // logical pin names + relative grid offsets
  spanX: number;                       // PITCH units (resistor = 4)
  spanY: number;                       // PITCH units (button = 2 — straddles trench)
  paletteIcon: string;                 // path k ikoně pro palette card
}

export interface PinSpec {
  name: string;                        // 'anode', 'D13', 'row-A-15'
  dx: number;                          // pin offset from component origin in PITCH units
  dy: number;
}
```

**Kompletní component registry pro Phase A — 10 typů:**

Pin offsets (`dx`, `dy`) a `spanX/Y` jsou v PITCH units (PITCH = 16px). Pin **names** vycházejí ze Štěpánových pravidel a běžné Arduino/breadboard nomenklatury; přesné CSS selectory pro shadow DOM piercing musí být zjištěny **před začátkem implementace** (viz "Implementation prerequisites" níže).

| Type | Label | wokwiTag | wokwiAttrs | spanX | spanY | Pins (name : dx,dy) |
|---|---|---|---|---|---|---|
| `arduino-uno` | Arduino Uno | `wokwi-arduino-uno` | — | (intrinsic) | (intrinsic) | D0–D13, A0–A5, 5V, 3V3, GND (×3), VIN, RESET, AREF — pin offsets viz wokwi source |
| `breadboard-half` | Breadboard | `wokwi-breadboard-half` | — | 30 | 10 | 170 pinů: rails (`top-+`, `top-−`, `bot-+`, `bot-−`) + bus rows `A1..E15` (above trench), `F1..J15` (below trench) |
| `led-red` | LED červená | `wokwi-led` | `{ color: 'red' }` | 1 | 1 | `anode: 0,0`, `cathode: 0,1` |
| `led-yellow` | LED žlutá | `wokwi-led` | `{ color: 'yellow' }` | 1 | 1 | `anode: 0,0`, `cathode: 0,1` |
| `led-green` | LED zelená | `wokwi-led` | `{ color: 'green' }` | 1 | 1 | `anode: 0,0`, `cathode: 0,1` |
| `led-blue` | LED modrá | `wokwi-led` | `{ color: 'blue' }` | 1 | 1 | `anode: 0,0`, `cathode: 0,1` |
| `led-rgb` | LED RGB | `wokwi-led-rgb` | — | 1 | 4 | `r: 0,0`, `cathode: 0,1`, `g: 0,2`, `b: 0,3` |
| `resistor-220` | Rezistor 220 Ω | `wokwi-resistor` | `{ value: '220' }` | 4 | 1 | `a: 0,0`, `b: 4,0` (5 děr inclusive) |
| `pushbutton` | Tlačítko | `wokwi-pushbutton` | `{ color: 'red' }` | 2 | 2 | `1a: 0,0`, `2a: 2,0`, `1b: 0,2`, `2b: 2,2` (straddles trench mezi y=0 a y=2) |
| `piezo-buzzer` | Piezo buzzer | `wokwi-buzzer` | — | 2 | 2 | `+: 0,0`, `−: 1,0` |
| `potentiometer` | Potenciometr | `wokwi-potentiometer` | — | 3 | 1 | `terminal-a: 0,0`, `signal: 1,0`, `terminal-b: 2,0` |
| `photoresistor` | Fotorezistor | `wokwi-photoresistor-sensor` | — | 2 | 1 | `dout: 0,0`, `gnd: 1,0`, `vcc: 2,0`, `aout: 3,0` |

**Pin offset konvence:** `dy=0` = horní řádek, `dx=0` = levý okraj komponenty. Komponenty které straddle trench (pushbutton) mají piny na `dy=0` a `dy=2` — řádek `dy=1` je trench gap.

**Příklad spec objektu pro LED červenou:**

```ts
{
  type: 'led-red',
  label: 'LED červená',
  wokwiTag: 'wokwi-led',
  wokwiAttrs: { color: 'red' },
  pins: [
    { name: 'anode',   dx: 0, dy: 0 },
    { name: 'cathode', dx: 0, dy: 1 },
  ],
  spanX: 1,
  spanY: 1,
  paletteIcon: '/cad/palette/led-red.png',
}
```

---

## UI flow & interakce

### Entry point — TaskDetail integrace

Existující `TaskDetail` ponecháme. Pod text-hint sekci zapojení přidáme nový panel:

```
┌─ TaskDetail ──────────────────────────┐
│  [Description]                         │
│                                        │
│  Zapojení                              │
│  • [text hint]                         │
│  • [text hint]                         │
│  ┌─ ▶ Postavit obvod (CAD) ───┐  ←  nový button
│  │  [thumbnail uloženého      │
│  │   obvodu nebo placeholder] │
│  └────────────────────────────┘
│                                        │
│  Kód                                   │
│  [textarea]  [Zkontrolovat]            │
└────────────────────────────────────────┘
```

Kliknutí otevře **fullscreen modal** s CAD workspace. Esc / "Zavřít" zavře (auto-save proběhl už za běhu).

### Workspace layout

```
┌─────────────────────────────────────────────────┐
│  [← Zpět]   beginner-led — LED      [⌫ Reset]  │  ← top bar
├──────────┬──────────────────────────────────────┤
│ PALETTE  │                                       │
│          │       INFINITE PLANE                  │
│ ┌──────┐ │       (zoom + pan)                    │
│ │ LED  │ │                                       │
│ └──────┘ │       [Arduino] ─── [Breadboard]      │
│ ┌──────┐ │                                       │
│ │ RES  │ │                                       │
│ └──────┘ │                                       │
│ ┌──────┐ │                                       │
│ │ BTN  │ │                                       │
│ └──────┘ │                                       │
│          │                                       │
└──────────┴───────────────────────────────────────┘
                                          [+] [-] [⊙]  ← zoom controls
```

### Interakce

| Akce | Trigger |
|---|---|
| Přidat komponentu | Drag z palette → drop na plane → snap PITCH |
| Přesunout komponentu | Mouse-down na komponentě → drag → snap PITCH na release |
| Smazat komponentu | Klik vybere → Delete/Backspace, nebo right-click → "Smazat" |
| Začít drát | Klik na pin (highlight pinů on hover) |
| Dokončit drát | Klik na cílový pin |
| Zrušit drát mid-draw | Esc nebo right-click |
| Smazat drát | Klik na drát vybere → Delete, nebo right-click |
| Pan plane | Mouse-down v prázdné oblasti → drag, nebo middle-click + drag |
| Zoom plane | Mouse wheel nad plane, nebo +/− tlačítka, nebo `⊙` reset-to-fit |
| Reset workspace | Top-bar tlačítko "Reset" → confirm → vymaže `circuits[taskId]` zpět na seed |
| Save | **Auto-save** debounced 200ms po každé změně |

### Visual state indikátory

- Pin highlight on hover (kid vidí kde "klikne se to chytí")
- Drát mid-draw následuje kurzor jako preview path
- Komponenta při dragu má opacity 0.6
- Selected komponenta/drát má outline (1px focus border)
- Grid dots vždy viditelné (light, scaled with plane transform)

### Pin hit-area workaround

Pin element v shadow DOM je tiny (~3px). Klik na něj = frustrující. Workaround: každá komponenta vykresluje **overlay invisible 12×12px hit-areas s `data-pin` atributem mimo shadow DOM**. Hover/click detection přes JS na overlay layer, ne na shadow DOM elementy.

---

## Struktura souborů

```
src/
├── types/
│   └── cad.ts                       (Circuit, CircuitComponent, Wire, PinRef, ComponentType)
│
├── lib/cad/
│   ├── constants.ts                  (PITCH=16, GRID_DOT_OPACITY, ZOOM_MIN/MAX, …)
│   ├── components.ts                 (ComponentSpec registry pro všech 10 typů)
│   ├── circuit.ts                    (createDefaultCircuit, applyTaskSeed, sanity helpers)
│   └── pins.ts                       (resolvePinPosition — shadow DOM piercing + cache)
│
├── components/cad/
│   ├── CADModal.tsx                  (fullscreen modal wrapper, lazy-loaded entry)
│   ├── CADWorkspace.tsx              (main; local reducer; debounced sync to GameState)
│   ├── Plane.tsx                     (infinite plane + pan/zoom transform)
│   ├── TopBar.tsx                    (Zpět / Reset / task title)
│   ├── Palette.tsx                   (left sidebar; renders cards podle palette[])
│   ├── PaletteCard.tsx               (single drag-source card)
│   ├── PlacedComponent.tsx           (renders <wokwi-*> + drag handle + selection + pin overlays)
│   ├── WireLayer.tsx                 (SVG overlay; renders all wires + in-progress)
│   ├── WirePath.tsx                  (single SVG <path>)
│   ├── ZoomControls.tsx              (+/− and reset-to-fit)
│   └── hooks/
│       ├── useCADReducer.ts          (local state + actions; in-flight UI state)
│       ├── useDragDrop.ts            (palette→plane drop, component reposition)
│       ├── useWiring.ts              (click-pin → click-pin flow)
│       ├── usePinPositions.ts        (shadow DOM pierce + coord mapping cache)
│       └── usePanZoom.ts             (plane transform; mouse wheel + drag)
│
└── components/screens/
    └── TaskDetail.tsx                (UPRAVIT — přidat CAD entry button)
```

### Změny v existujících souborech

| Soubor | Změna |
|---|---|
| `src/types/index.ts` | (a) Rozšířit `Task` o `cad?: { palette: ComponentType[]; seed?: CircuitComponent[] }`. (b) Přidat `circuits: Record<TaskId, Circuit>` do `GameState`. (c) Přidat `circuits: Record<TaskId, Circuit>` do `PerStudentAccount`. (d) Přidat `circuits: Record<TaskId, Circuit>` do `SyncableState`. |
| `src/lib/tasks.ts` | Doplnit `cad.palette` u prvních 8 beginner úkolů |
| `src/components/providers/GameStateProvider.tsx` | (a) Přidat action `SAVE_CIRCUIT { taskId, circuit }`. (b) Updatovat `syncCurrentStudent()` aby kopíroval `circuits` do `accounts[currentStudentNumber]`. (c) Při LOGIN_STUDENT načíst `accounts[N].circuits` zpět do `state.circuits` (nebo `{}` pokud chybí). |
| `src/lib/storage.ts` | (a) `createDefaultGameState()` initialize `circuits: {}`. (b) `loadGameState()` defaultovat `parsed.circuits ?? {}` při HYDRATE pro forward-compat. (c) `normalizePerStudentAccount()` defaultovat `student.circuits ?? {}`. |
| `src/lib/cloud-sync.ts` | Přidat `circuits: state.circuits` do `extractSyncableState()` returnu |
| `src/components/screens/TaskDetail.tsx` | Přidat "Postavit obvod" button (jen pokud `task.cad`) + lazy import `CADModal` |
| `package.json` | Přidat `@wokwi/elements` (peer dep `lit` se nainstaluje automaticky) |

### Explicitní type definitions po změnách

```ts
// src/types/index.ts (konečný stav po Phase A změnách)

import type { Circuit, CircuitComponent, ComponentType } from "@/types/cad";

export interface PerStudentAccount {
  account: AccountState;
  tasks: Record<string, TaskState>;
  sections: Record<SectionId, { unlocked: boolean }>;
  circuits: Record<string, Circuit>;     // ← new (default {})
}

export interface GameState {
  // ...existing fields unchanged
  circuits: Record<string, Circuit>;     // ← new (default {}), current-student's circuits
}

export interface SyncableState {
  account: AccountState;
  tasks: Record<string, TaskState>;
  sections: Record<SectionId, { unlocked: boolean }>;
  circuits: Record<string, Circuit>;     // ← new
}

export interface Task {
  // ...existing fields unchanged
  cad?: {
    palette: ComponentType[];
    seed?: CircuitComponent[];
  };
}
```

### Klíčové architectural patterns

- **`CADModal` je `next/dynamic` import** — code-split, kid co neotevře CAD nestáhne wokwi bundle.
- **`useCADReducer` vrací `[state, dispatch]`** — vše uvnitř workspace dispatchuje sem. Sync layer odebírá z reduceru přes `useEffect` s debounce.
- **`usePinPositions` cache** — Shadow DOM query je drahý. Cache podle `compId:pinName` invaliduje při komponent move / zoom / scroll. Re-compute lazy při wire render.
- **Žádný state v jednotlivých `PlacedComponent`** — každá je čistě render funkce z `comp` propu. Drag interakce řídí parent přes refs/handlers.

---

## Persistence — multi-student a edge cases

### Multi-student data flow

App podporuje multi-student mode (více kidů na jednom zařízení, oddělené přes `studentNumber`). `GameState.circuits` reprezentuje **aktuálního přihlášeného studenta**. Při přepnutí studenta:

```
LOGIN_STUDENT { studentNumber }
  ↓
Pokud accounts[N] existuje → state.circuits = accounts[N].circuits ?? {}
Pokud ne → state.circuits = {} (nový student)
```

`syncCurrentStudent()` po každé akci kopíruje aktuální `state.circuits` do `accounts[currentStudentNumber].circuits` — stejný pattern jako pro `tasks`/`account`/`sections`.

**Cloud sync** přes `extractSyncableState()` posílá circuits přihlášeného studenta. Linked Supabase user = 1:1 s konkrétním studentNumber (`linkedUserId`), takže sync je jednoznačný.

### Edge cases

| Případ | Chování |
|---|---|
| Kid otevře CAD poprvé pro úkol | `state.circuits[taskId]` neexistuje → CAD zobrazí default seed v paměti. **Nezapisujeme** do state dokud kid neudělá změnu. |
| Kid zavře CAD bez úprav | Žádný save. `state.circuits[taskId]` zůstane undefined. Příští otevření = stejný výchozí seed. |
| Kid přidá první komponentu | `useCADReducer` updatuje lokální stav → debounce 200ms → `dispatch SAVE_CIRCUIT { taskId, circuit }`. Od teď `state.circuits[taskId]` existuje. |
| Kid klikne Reset | Confirm dialog → `dispatch SAVE_CIRCUIT { taskId, circuit: defaultSeedForTask(task) }`. Reset **ZAPÍŠE** seed do state (ne mažeme klíč), aby cloud-sync to vidělo a nepřišel zpět starý cloud snapshot. |
| Kid je offline | LocalStorage save funguje. Cloud-sync se zachytí později (existing offline banner). |
| Cross-device sync | Login na druhém zařízení → `state.circuits` přijde z `learning_accounts.state.circuits` → CAD otevře poslední uloženou verzi. |
| Kid spadne mid-drag | Lokální stav ztracen, ale GameState je z posledního debounced save. Worst case: ztratí pohyb 1 komponenty. |
| Kid přepne student v admin preview | `state.circuits` se přepne na `accounts[N].circuits`. CAD modal je v té chvíli zavřený (admin akce zavírá detail). |

### Migrace existujících uživatelů

`state.circuits` ani `accounts[N].circuits` neexistují v současných localStorage zápisech. Žádný migration script není potřeba — `loadGameState()` prostě defaultuje `circuits ?? {}` jak na top-levelu, tak v každém PerStudentAccount během `normalizePerStudentAccount()`. Stejný pattern jako u `unlockedAvatars` v existujícím normalizéru.

---

## Testing strategy

- **Unit testy** (Vitest, kde dává smysl):
  - `lib/cad/circuit.ts` — createDefaultCircuit + applyTaskSeed (čisté funkce)
  - `lib/cad/components.ts` — registry consistency check (každý ComponentType má spec)
  - Reducer (`useCADReducer`) — actions vyrobí očekávaný state
- **Manuální E2E checklist** — drag/drop a wire kreslení záleží na DOM/shadow DOM, automatizace náročná. V Phase A spíš checklist:
  1. Otevři LED úkol → CAD se zobrazí s Arduinem + breadboardem
  2. Přetáhni LED z palette → snapuje na breadboard hole
  3. Klikni na LED anode → klikni na Arduino D13 → drát se vykreslí
  4. Zavři modal → znovu otevři → obvod je zachován
  5. Reset tlačítko → obvod se vrátí na seed
- **Vizuální review** — Štěpán otestuje na svém stroji s vlastními úkoly.

---

## Implementation prerequisites (před writing-plans)

Tyto úkoly musí proběhnout **před** psaním implementačního plánu, jinak plán bude obsahovat hádání:

1. **Reverse-engineer logical pin selectors** — pro každou z 10 ComponentType v registry zjistit přesné CSS selectory v shadow DOM `<wokwi-*>` elementů. Postup:
   - `npm install @wokwi/elements` v sandboxové větvi
   - Pro každý web component otevřít DevTools → inspect Shadow Root → vyextrahovat selectory pro každý pin (např. `wokwi-led` má pravděpodobně `circle.anode`, `circle.cathode` nebo `[data-pin]` atributy)
   - Výstup: tabulka `{ wokwiTag → { logicalPinName → cssSelector } }` v `src/lib/cad/pin-selectors.ts`
   - **Bottleneck:** breadboard má 170 pinů, naivně 170 selectorů. Pravděpodobně lze použít jeden pattern selector (`[data-row][data-col]`) — záleží jak wokwi exposed je
   - **Budget:** 1–2 hodiny. Pokud > 4 hodin → eskalovat (možná wokwi/elements pin model nestačí a musíme custom)

2. **Měření bundle size** — `npm install @wokwi/elements` + zaznamenat dopad na production bundle (`next build` + analyze). Cílový strop: 200 kB gzipped pro lazy-loaded CAD chunk. Pokud překročí, plán musí obsahovat selektivní import.

3. **React 19 + web components compat smoke test** — minimální test: vykreslit `<wokwi-led color="red">` v React 19 komponentě, ověřit že shadow DOM se vyrenderoval bez warnings. Pokud problém → workaround dokumentovat v plánu.

## Identifikovaná rizika

1. **`@wokwi/elements` bundle size** — viz prerequisite #2. Code-splitting přes `next/dynamic` izoluje, ale potřebujeme číslo.

2. **Wokwi vs React 19** — `wokwi/elements` jsou Web Components (Lit-based). React 19 má nativní support, ale custom event handling (`onpinchange` apod.) ne přes camelCase props. Workaround: `useEffect` + `addEventListener` přes ref. Viz prerequisite #3.

3. **Shadow DOM pin queries performance** — `wokwi-breadboard-half` má **170 pinů**. Naive query při každém renderu = drahé. Cache by `compId:pinName`, invalidace při move/zoom/scroll.

4. **Drát který protíná komponentu** — Phase A ignoruje routing. Drát = direct line `from → to`. Phase B+ může přidat orthogonal routing. Pro v1 OK pro 95 % případů u beginner úkolů.

5. **Multi-student admin preview hazard** — `adminPreviewActive` flag mění reducer behavior (admin browse-only mode). CAD modal **nesmí** umožnit Save když `adminPreviewActive === true` — jinak by admin zničil studentova data. Plán musí pokrýt: CAD button v TaskDetail je read-only (nebo skrytý) v admin preview módu. Tohle je explicitní acceptance criterion.

---

## Definice "done" pro Phase A

Phase A je hotová když:

- [ ] Kid v `beginner-led` úkolu klikne "Postavit obvod" a otevře se fullscreen CAD
- [ ] Workspace má pre-seeded Arduino + breadboard, palette s LED + resistor + pushbutton
- [ ] Kid přetáhne LED na breadboard, snapuje na PITCH
- [ ] Kid přetáhne resistor na breadboard, snapuje na PITCH (zabírá 5 děr)
- [ ] Kid přetáhne pushbutton na breadboard (straddles trench)
- [ ] Kid kreslí dráty kliknutím mezi piny — Arduino D13 → row 15a, row 15b → LED anode, atd.
- [ ] Kid zavře CAD → obvod se uložil do localStorage + (pokud authenticated) Supabase
- [ ] Kid znovu otevře CAD → vidí svůj uložený obvod
- [ ] Reset tlačítko vrátí workspace na seed
- [ ] Kid pokračuje na druhém zařízení po loginu → vidí svůj obvod z prvního zařízení
- [ ] Code regex flow je nedotčený — reward se stále uděluje za code regex, CAD je purely additivní

Phase A **neodemyká** simulaci, validaci proti reference circuit ani Blockly editor. To přijde v Phase B/C.

---

## Po Phase A

Po dokončení Phase A vznikne brainstorm pro **Phase B (Simulation Layer)**:

- Integrace AVR8js do existujícího CAD enginu
- Mapování `Circuit` na simulátor net topology (Arduino piny → breadboard rails → komponenty)
- Real-time render simulačního stavu (LED on/off, multimetr, scope)
- Validace úkolu = "kid kód běží na kid obvodu, behavior matches expected" (opouští code-regex reward gate)

A poté **Phase C (Blockly Code Editor)** — visual blocks ↔ text bidirectional, integrace s Phase B simulací.
