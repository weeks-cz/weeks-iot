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
