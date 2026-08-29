import { useReducer } from "react";
import { DEFAULT_PAN, PITCH, ZOOM_DEFAULT } from "../constants";
import type { Circuit, CircuitComponent, ComponentType, PinRef, Wire } from "../types";

/**
 * Stav skládání obvodu.
 *
 * Přenesené z CAD builderu staré aplikace. Beze změny zůstala mechanika
 * (drátek se kreslí ze dvou kliknutí na piny, součástka se táhne po mřížce);
 * přibyla „nachystaná" součástka z palety, protože na tabletu se táhnout nedá.
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
  zoom: number;
  pan: { x: number; y: number };
}

export type BuilderAction =
  | { type: "PLACE"; comp: CircuitComponent }
  | { type: "MOVE"; id: string; x: number; y: number }
  | { type: "DELETE_COMPONENT"; id: string }
  | { type: "BEGIN_WIRE"; from: PinRef }
  | { type: "FINISH_WIRE"; to: PinRef }
  | { type: "CANCEL_WIRE" }
  | { type: "DELETE_WIRE"; id: string }
  | { type: "SELECT"; target: Selection }
  | { type: "SET_CURSOR"; pos: { x: number; y: number } | null }
  | { type: "ARM"; kind: ComponentType | null }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_PAN"; pan: { x: number; y: number } }
  | { type: "RESET"; circuit: Circuit };

export function initBuilderState(circuit: Circuit): BuilderState {
  return {
    circuit,
    selection: null,
    wireFrom: null,
    cursor: null,
    armed: null,
    zoom: ZOOM_DEFAULT,
    pan: DEFAULT_PAN,
  };
}

export function snapToGrid(value: number): number {
  return Math.round(value / PITCH) * PITCH;
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "PLACE":
      return {
        ...state,
        circuit: { ...state.circuit, comps: [...state.circuit.comps, action.comp] },
        /* Po položení se paleta odjistí. Kdo chce dvě LED, klepne dvakrát —
           ale nechtěné rozsypání součástek při každém dalším doteku je horší
           chyba než jedno klepnutí navíc. */
        armed: null,
        selection: { kind: "component", id: action.comp.id },
      };

    case "MOVE":
      return {
        ...state,
        circuit: {
          ...state.circuit,
          comps: state.circuit.comps.map((c) =>
            c.id === action.id ? { ...c, x: action.x, y: action.y } : c,
          ),
        },
      };

    case "DELETE_COMPONENT": {
      const comps = state.circuit.comps.filter((c) => c.id !== action.id);
      /* Drátky visící ve vzduchu po smazané součástce nedávají smysl. */
      const wires = state.circuit.wires.filter(
        (w) => w.from.compId !== action.id && w.to.compId !== action.id,
      );
      return {
        ...state,
        circuit: { comps, wires },
        selection: null,
      };
    }

    case "BEGIN_WIRE":
      return { ...state, wireFrom: action.from, selection: null };

    case "FINISH_WIRE": {
      if (!state.wireFrom) return state;

      const from = state.wireFrom;
      const to = action.to;

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

    case "ARM":
      return { ...state, armed: action.kind, wireFrom: null, cursor: null };

    case "SET_ZOOM":
      return { ...state, zoom: action.zoom };

    case "SET_PAN":
      return { ...state, pan: action.pan };

    case "RESET":
      return initBuilderState(action.circuit);

    default:
      return state;
  }
}

function samePin(a: PinRef, b: PinRef): boolean {
  return a.compId === b.compId && a.pinName === b.pinName;
}

export function useBuilderReducer(initial: Circuit) {
  return useReducer(builderReducer, initial, initBuilderState);
}
