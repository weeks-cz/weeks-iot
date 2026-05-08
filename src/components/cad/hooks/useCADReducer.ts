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
  cursorPlane: { x: number; y: number } | null;
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
  return { circuit, selection: null, wireInProgress: null, cursorPlane: null, zoom: 1, pan: { x: 0, y: 0 } };
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
      const wire: Wire = { id: crypto.randomUUID(), from: state.wireInProgress, to: action.to };
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
