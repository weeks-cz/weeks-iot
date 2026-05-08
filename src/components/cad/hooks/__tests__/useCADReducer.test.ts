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
