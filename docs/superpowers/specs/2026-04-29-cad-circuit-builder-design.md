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

**Příklad — LED:**

```ts
{
  type: 'led-red',
  label: 'LED červená',
  wokwiTag: 'wokwi-led',
  wokwiAttrs: { color: 'red' },
  pins: [
    { name: 'anode',   dx: 0, dy: 0 },
    { name: 'cathode', dx: 0, dy: 1 },  // 1 PITCH apart (LED nohy span)
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
| `src/types/index.ts` | Rozšířit `Task` o `cad?: { palette, seed? }`; přidat `circuits: Record<TaskId, Circuit>` do `GameState`; přidat `circuits` do `SyncableState` |
| `src/lib/tasks.ts` | Doplnit `cad.palette` u prvních 8 beginner úkolů |
| `src/components/providers/GameStateProvider.tsx` | Přidat action `SAVE_CIRCUIT { taskId, circuit }`, init `state.circuits = {}` |
| `src/lib/storage.ts` | Default `circuits ?? {}` v `loadGameState()` (žádná migration) |
| `src/lib/cloud-sync.ts` | Přidat `circuits` do `extractSyncableState()` |
| `src/components/screens/TaskDetail.tsx` | Přidat "Postavit obvod" button + lazy import `CADModal` |
| `package.json` | Přidat `@wokwi/elements` |

### Klíčové architectural patterns

- **`CADModal` je `next/dynamic` import** — code-split, kid co neotevře CAD nestáhne wokwi bundle.
- **`useCADReducer` vrací `[state, dispatch]`** — vše uvnitř workspace dispatchuje sem. Sync layer odebírá z reduceru přes `useEffect` s debounce.
- **`usePinPositions` cache** — Shadow DOM query je drahý. Cache podle `compId:pinName` invaliduje při komponent move / zoom / scroll. Re-compute lazy při wire render.
- **Žádný state v jednotlivých `PlacedComponent`** — každá je čistě render funkce z `comp` propu. Drag interakce řídí parent přes refs/handlers.

---

## Persistence — edge cases

| Případ | Chování |
|---|---|
| Kid otevře CAD poprvé pro úkol | `state.circuits[taskId]` neexistuje → použít default seed (Arduino + breadboard) |
| Kid zavře CAD bez úprav | Žádný save. `state.circuits[taskId]` zůstane undefined. |
| Kid klikne Reset | `dispatch({ type: 'SAVE_CIRCUIT', taskId, circuit: defaultSeed })` — reset ZAPÍŠE seed (ne mažeme klíč), aby cloud-sync to vidělo. |
| Kid je offline | LocalStorage save funguje. Cloud-sync se zachytí později (existing offline banner). |
| Cross-device sync | Login na druhém zařízení → `state.circuits` přijde z `learning_accounts.state` → CAD otevře poslední uloženou verzi. |
| Kid spadne mid-drag | Lokální stav ztracen, ale GameState je z posledního debounced save. Worst case: ztratí pohyb 1 komponenty. |

**Migrace existujících uživatelů** — `state.circuits` neexistuje v současných localStorage zápisech. V `loadGameState()` jen default `circuits ?? {}`. Žádný migration script.

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

## Identifikovaná rizika & otevřené otázky

1. **`@wokwi/elements` bundle size** — neznámé, code-splitting přes `next/dynamic` izoluje, ale potřebujeme změřit. Pokud > 200kB gzipped, zvážit selektivní import jednotlivých web components.

2. **Wokwi vs React 19** — `wokwi/elements` jsou Web Components (Lit-based). React 19 má nativní support, ale custom event handling (`onpinchange` apod.) ne přes camelCase props. Workaround: `useEffect` + `addEventListener` přes ref.

3. **Shadow DOM pin queries performance** — `wokwi-breadboard-half` má **170 pinů**. Naive query at každý render = drahé. Cache by `compId:pinName`, invalidace při move/zoom.

4. **Drát který protíná komponentu** — Phase A ignoruje routing. Drát = direct line `from → to`. Phase B+ může přidat orthogonal routing. Pro v1 OK pro 95 % případů u beginner úkolů.

5. **Logical pin names** — pro `wokwi-breadboard-half` musíme zjistit přesné selectory pro 170 pinů (např. `[data-pin="A1"]`). To se vyřeší při implementaci čtením wokwi/elements zdrojáku — není to design risk, ale implementační detail.

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
