import { useReducer } from "react";
import { DEFAULT_PAN, PITCH, ZOOM_DEFAULT } from "../constants";
import { isRotatable, normalizeRotation, rotatedOrigin, type Rotation } from "../pins";
import { occupiedSockets, placementConflicts } from "../occupancy";
import { pinKey } from "../nets";
import type { Circuit, CircuitComponent, ComponentType, PinRef, Wire } from "../types";

/**
 * Stav skládání obvodu.
 *
 * Přenesené z CAD builderu staré aplikace. Beze změny zůstala mechanika
 * (drátek se kreslí ze dvou kliknutí na piny, součástka se táhne po mřížce);
 * přibyla „nachystaná" součástka z palety. Z palety jde táhnout i klepnout:
 * táhnout čeká každý, kdo kdy skládal cokoli na obrazovce, klepnutí je
 * pohodlnější na tabletu.
 */

export type Selection = { kind: "component"; id: string } | { kind: "wire"; id: string } | null;

export interface BuilderState {
  circuit: Circuit;
  selection: Selection;
  /** Pin, ze kterého se právě vede drátek. */
  wireFrom: PinRef | null;
  /** Kam ukazuje kurzor, aby šel rozkreslený drátek vykreslit. */
  cursor: { x: number; y: number } | null;
  /** Součástka vybraná v paletě, čekající na klepnutí do plochy. */
  armed: ComponentType | null;
  /** Otočení nachystané součástky. Otáčí se klávesou R, dokud čeká v paletě. */
  armedRotation: Rotation;
  /** Táhne se právě z palety? Pak se položí tam, kde dítě pustí. */
  dragging: boolean;
  zoom: number;
  pan: { x: number; y: number };
}

export type BuilderAction =
  | { type: "PLACE"; comp: CircuitComponent }
  /**
   * Přesun součástky. `carry` jsou součástky zapíchnuté do desky, která se
   * přesouvá — jedou s ní o stejný posun a zůstanou v dírkách.
   */
  | { type: "MOVE"; id: string; x: number; y: number; carry?: string[] }
  | { type: "ROTATE"; id: string }
  | { type: "DELETE_COMPONENT"; id: string }
  | { type: "BEGIN_WIRE"; from: PinRef }
  | { type: "FINISH_WIRE"; to: PinRef }
  | { type: "CANCEL_WIRE" }
  | { type: "DELETE_WIRE"; id: string }
  | { type: "SELECT"; target: Selection }
  | { type: "SET_CURSOR"; pos: { x: number; y: number } | null }
  | { type: "ARM"; kind: ComponentType | null; drag?: boolean }
  | { type: "ROTATE_ARMED" }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_PAN"; pan: { x: number; y: number } }
  | { type: "RESET"; circuit: Circuit };

/**
 * Obvod z uložené koncepce nebo z dat lekce, s doplněným otočením.
 *
 * Koncepty uložené před otáčením nemají `rotation` — musí se načíst jako 0,
 * jinak by se součástka po prvním dotyku otočila o nesmysl.
 */
export function normalizeCircuit(circuit: Circuit): Circuit {
  return {
    ...circuit,
    comps: circuit.comps.map((c) => ({ ...c, rotation: normalizeRotation(c.rotation) })),
  };
}

export function initBuilderState(circuit: Circuit): BuilderState {
  return {
    circuit: normalizeCircuit(circuit),
    selection: null,
    wireFrom: null,
    cursor: null,
    armed: null,
    armedRotation: 0,
    dragging: false,
    zoom: ZOOM_DEFAULT,
    pan: DEFAULT_PAN,
  };
}

export function snapToGrid(value: number): number {
  return Math.round(value / PITCH) * PITCH;
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "PLACE": {
      /* Dvě stejné součástky na totéž místo se nepokládají. Překrývají se
         přesně, takže to vypadá jako jedna — dítě klepne, nevidí změnu,
         klepne znovu a má v obvodu neviditelný nepořádek. */
      const comp: CircuitComponent = {
        ...action.comp,
        rotation: normalizeRotation(action.comp.rotation),
      };
      const occupied = state.circuit.comps.some(
        (c) => c.type === comp.type && c.x === comp.x && c.y === comp.y,
      );
      if (occupied) return { ...state, armed: null, dragging: false };

      /* Nožička by padla do dírky, která už je něčí. Položení se odmítne —
         náhled to ukázal červeně, dítě ví, proč se nic nestalo. */
      if (placementConflicts(state.circuit, comp)) return { ...state, dragging: false };

      return {
        ...state,
        circuit: { ...state.circuit, comps: [...state.circuit.comps, comp] },
        /* Po položení se paleta odjistí. Kdo chce dvě LED, klepne dvakrát —
           ale nechtěné rozsypání součástek při každém dalším doteku je horší
           chyba než jedno klepnutí navíc. */
        armed: null,
        dragging: false,
        /* Nově položená součástka se nevybírá sama. Vybraná by na desce
           pořád ukazovala rámeček a dítě by nevědělo proč. */
        selection: null,
      };
    }

    case "MOVE":
      return moveComponent(state, action);

    case "ROTATE": {
      const turned = turnedComponent(state.circuit, action.id);
      if (!turned) return state;
      return {
        ...state,
        circuit: {
          ...state.circuit,
          comps: state.circuit.comps.map((c) => (c.id === turned.id ? turned : c)),
        },
      };
    }

    case "DELETE_COMPONENT": {
      const comps = state.circuit.comps.filter((c) => c.id !== action.id);
      /* Drátky visící ve vzduchu po smazané součástce nedávají smysl. Tím
         se odpojí i součástky zapíchnuté do smazané desky — stojí dál,
         jen už nejsou v žádné síti. */
      const wires = state.circuit.wires.filter(
        (w) => w.from.compId !== action.id && w.to.compId !== action.id,
      );
      return {
        ...state,
        circuit: { comps, wires },
        selection: null,
      };
    }

    case "BEGIN_WIRE": {
      /* Dírka nebo pin Arduina, do kterého něco už vede, se nedá použít
         znovu. Nic se neděje — výběr ani rozdělaný drátek se nemění. */
      if (occupiedSockets(state.circuit).has(pinKey(action.from.compId, action.from.pinName))) {
        return state;
      }
      return { ...state, wireFrom: action.from, selection: null };
    }

    case "FINISH_WIRE": {
      if (!state.wireFrom) return state;

      const from = state.wireFrom;
      const to = action.to;

      /* Nožička ke své vlastní nožičce je zkrat, ne spoj. Rozdělaný drátek
         zůstane, dítě může zvolit jiný cíl. */
      if (from.compId === to.compId && !isBoard(state.circuit, to.compId)) return state;

      /* Do dírky nebo na pin Arduina, který už něco drží, se nezapojí nic. */
      if (occupiedSockets(state.circuit).has(pinKey(to.compId, to.pinName))) return state;

      /* Drátek sám do sebe ani druhý stejný drátek nic nepřidají. */
      const duplicate = state.circuit.wires.some(
        (w) =>
          (samePin(w.from, from) && samePin(w.to, to)) ||
          (samePin(w.from, to) && samePin(w.to, from)),
      );
      if (samePin(from, to) || duplicate) {
        return { ...state, wireFrom: null, cursor: null };
      }

      const wire: Wire = { id: crypto.randomUUID(), from, to };
      return {
        ...state,
        circuit: { ...state.circuit, wires: [...state.circuit.wires, wire] },
        wireFrom: null,
        cursor: null,
      };
    }

    case "CANCEL_WIRE":
      return { ...state, wireFrom: null, cursor: null };

    case "DELETE_WIRE":
      return {
        ...state,
        circuit: {
          ...state.circuit,
          wires: state.circuit.wires.filter((w) => w.id !== action.id),
        },
        selection: null,
      };

    case "SELECT":
      return { ...state, selection: action.target };

    case "SET_CURSOR":
      return { ...state, cursor: action.pos };

    case "ROTATE_ARMED":
      if (!state.armed || !isRotatable(state.armed)) return state;
      return { ...state, armedRotation: ((state.armedRotation + 90) % 360) as Rotation };

    case "ARM":
      return {
        ...state,
        armed: action.kind,
        armedRotation: 0,
        dragging: Boolean(action.kind && action.drag),
        wireFrom: null,
        cursor: null,
      };

    case "SET_ZOOM":
      return { ...state, zoom: action.zoom };

    case "SET_PAN":
      return { ...state, pan: action.pan };

    case "RESET":
      /* Výřez zůstává: obvod přichází zvenku (krok „Zapoj za mě") a plocha
         by po každém kroku uskakovala na výchozí pozici. Kdo chce výřez
         na celý obvod, volá fit sám. */
      return { ...initBuilderState(action.circuit), zoom: state.zoom, pan: state.pan };

    default:
      return state;
  }
}

/**
 * Součástka po otočení o čtvrt kola, nebo null, když se otočit nedá.
 *
 * Nedá se, když by nožičky padly do obsazené dírky: jinak by se po otočení
 * dvě věci tiše zapíchly do jedné dírky. Deska a Arduino se neotáčí.
 */
export function turnedComponent(circuit: Circuit, id: string): CircuitComponent | null {
  const comp = circuit.comps.find((c) => c.id === id);
  if (!comp || !isRotatable(comp.type)) return null;

  const next = ((normalizeRotation(comp.rotation) + 90) % 360) as Rotation;
  const at = rotatedOrigin(comp, next);
  const turned: CircuitComponent = {
    ...comp,
    rotation: next,
    x: snapToGrid(at.x),
    y: snapToGrid(at.y),
  };

  return placementConflicts(circuit, turned, new Set([comp.id])) ? null : turned;
}

/** Jde vybranou součástku otočit? Pro popisek u tlačítka. */
export function canRotate(circuit: Circuit, id: string): boolean {
  return turnedComponent(circuit, id) !== null;
}

function isBoard(circuit: Circuit, compId: string): boolean {
  return circuit.comps.some((c) => c.id === compId && c.type === "breadboard-half");
}

/**
 * Přesun součástky, případně se zapíchnutými díly.
 *
 * Desku posouvá po celém kroku mřížky — zapíchnuté díly jedou o stejný
 * posun, takže zůstanou přesně v dírkách. Drátky jdou s deskou samy, protože
 * se váží na jména dírek, ne na souřadnice.
 */
function moveComponent(
  state: BuilderState,
  action: { id: string; x: number; y: number; carry?: string[] },
): BuilderState {
  const comp = state.circuit.comps.find((c) => c.id === action.id);
  if (!comp) return state;

  const carry = new Set(action.carry ?? []);
  const isBoardMove = comp.type === "breadboard-half";
  const x = isBoardMove ? snapToGrid(action.x) : action.x;
  const y = isBoardMove ? snapToGrid(action.y) : action.y;
  const dx = x - comp.x;
  const dy = y - comp.y;

  const moved = new Set([action.id, ...carry]);
  const comps = state.circuit.comps.map((c) => {
    if (c.id === action.id) return { ...c, x, y };
    if (carry.has(c.id)) return { ...c, x: c.x + dx, y: c.y + dy };
    return c;
  });
  const next: Circuit = { ...state.circuit, comps };

  /* Součástka přesunutá na obsazené dírky se nepřesune — kdyby se tam
     zapíchla, byla by v jedné dírce dvě věci. Stojí tam, kde byla. */
  for (const c of comps) {
    if (!moved.has(c.id)) continue;
    if (placementConflicts(next, c, moved)) return state;
  }

  return { ...state, circuit: next };
}

function samePin(a: PinRef, b: PinRef): boolean {
  return a.compId === b.compId && a.pinName === b.pinName;
}

export function useBuilderReducer(initial: Circuit) {
  return useReducer(builderReducer, initial, initBuilderState);
}
