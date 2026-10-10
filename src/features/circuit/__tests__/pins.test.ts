import { describe, expect, it } from "vitest";
import { PITCH } from "../constants";
import {
  drawBounds,
  normalizeRotation,
  resolvePinPosition,
  rotatedOrigin,
  rotationTransform,
  rotateOffset,
} from "../pins";
import { COMPONENT_REGISTRY } from "../components";
import type { CircuitComponent, ComponentType } from "../types";

/**
 * Poloha nožiček po otočení. Všechno, co se kreslí, se hledá nebo zapichuje
 * přes tohle — když tu něco nesedí, nesedí to všude.
 */

const comp = (type: ComponentType, rotation: 0 | 90 | 180 | 270, x = 0, y = 0): CircuitComponent => ({
  id: "c",
  type,
  x,
  y,
  rotation,
});

describe("poloha pinů při otočení", () => {
  /* LED: rozpětí 4×6 rozteče, katoda (2,5), anoda (3,5). Počítáno ručně:
     0°   anoda (3,5)            → (3,5)
     90°  střed (2,3) otočen     → (1,3)
     180° (4−3, 6−5)             → (1,1)
     270° (5, 4−3)               → (5,1) */
  it.each([
    [0, { x: 3, y: 5 }],
    [90, { x: 1, y: 3 }],
    [180, { x: 1, y: 1 }],
    [270, { x: 5, y: 1 }],
  ] as const)("anoda LED při %i° sedí na správné dírce", (rotation, cell) => {
    const pos = resolvePinPosition(comp("led-red", rotation, 160, 320), "anode");
    expect(pos).toEqual({ x: 160 + cell.x * PITCH, y: 320 + cell.y * PITCH });
  });

  it("všechny piny zůstávají na mřížce při každém otočení", () => {
    const types: ComponentType[] = [
      "led-red", "led-rgb", "resistor-220", "pushbutton", "piezo-buzzer", "potentiometer", "photoresistor",
    ];
    for (const type of types) {
      for (const rotation of [0, 90, 180, 270] as const) {
        for (const pin of COMPONENT_REGISTRY[type].pins) {
          const pos = resolvePinPosition(comp(type, rotation, 160, 320), pin.name)!;
          expect(pos.x % PITCH, `${type} ${pin.name} ${rotation}°`).toBe(0);
          expect(pos.y % PITCH, `${type} ${pin.name} ${rotation}°`).toBe(0);
        }
      }
    }
  });

  it("čtyři otočení jsou čtyři různá místa pro asymetrickou součástku", () => {
    const seen = new Set(
      ([0, 90, 180, 270] as const).map((r) => {
        const p = resolvePinPosition(comp("led-red", r), "anode")!;
        return `${p.x},${p.y}`;
      }),
    );
    expect(seen.size).toBe(4);
  });

  it("bez otočení je poloha přímo x + dx·rozteč", () => {
    const pos = resolvePinPosition(comp("resistor-220", 0, 96, 64), "b");
    expect(pos).toEqual({ x: 96 + 4 * PITCH, y: 64 });
  });

  it("odpor se po čtvrtotočení postaví na výšku", () => {
    const a = resolvePinPosition(comp("resistor-220", 90, 0, 0), "a")!;
    const b = resolvePinPosition(comp("resistor-220", 90, 0, 0), "b")!;
    expect(a.x).toBe(b.x);
    expect(Math.abs(b.y - a.y)).toBe(4 * PITCH);
  });

  it("střed otáčení zůstane na místě", () => {
    /* Po otočení se počátek posune tak, aby se střed obdélníku nehnul. */
    const before = comp("led-red", 0, 160, 160);
    const at = rotatedOrigin(before, 90);
    const centreBefore = { x: 160 + 2 * PITCH, y: 160 + 3 * PITCH };
    const after = comp("led-red", 90, at.x, at.y);
    const cr = rotateOffset("led-red", 90, { x: 2 * PITCH, y: 3 * PITCH });
    expect(after.x + cr.x).toBeCloseTo(centreBefore.x, 5);
    expect(after.y + cr.y).toBeCloseTo(centreBefore.y, 5);
  });

  it("normalizeRotation bere cokoli divného jako 0", () => {
    expect(normalizeRotation(undefined)).toBe(0);
    expect(normalizeRotation(45)).toBe(0);
    expect(normalizeRotation(null)).toBe(0);
    expect(normalizeRotation(270)).toBe(270);
  });
});

describe("kresba se otáčí stejně jako nožičky", () => {
  /* Kresba je CSS transformace. Rozebereme řetězec a aplikujeme ho na body
     tak, jak to dělá prohlížeč (translate · rotate · translate). Musí dát
     totéž co rotateOffset, jinak nožička visí vedle kresby. */
  function applyCss(transform: string, p: { x: number; y: number }) {
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) rotate\((-?\d+)deg\) translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(transform);
    if (!m) throw new Error(`neznámá transformace: ${transform}`);
    const [tx, ty, deg, cx, cy] = m.slice(1).map(Number) as [number, number, number, number, number];
    const r = (deg * Math.PI) / 180;
    const u = p.x + cx;
    const v = p.y + cy;
    return {
      x: tx + Math.cos(r) * u - Math.sin(r) * v,
      y: ty + Math.sin(r) * u + Math.cos(r) * v,
    };
  }

  it.each(["led-red", "resistor-220", "pushbutton", "potentiometer"] as const)(
    "%s: CSS i matematika souhlasí při každém otočení",
    (type) => {
      for (const rotation of [90, 180, 270] as const) {
        const spec = COMPONENT_REGISTRY[type];
        for (const pin of spec.pins) {
          const p = { x: pin.dx * PITCH, y: pin.dy * PITCH };
          const expected = rotateOffset(type, rotation, p);
          const got = applyCss(rotationTransform(type, rotation), p);
          expect(got.x).toBeCloseTo(expected.x, 6);
          expect(got.y).toBeCloseTo(expected.y, 6);
        }
      }
    },
  );

  it("obal kresby se po čtvrtotočení přehodí na šířku a výšku", () => {
    const flat = drawBounds(comp("resistor-220", 0));
    const upright = drawBounds(comp("resistor-220", 90));
    expect(upright.w).toBeCloseTo(flat.h, 6);
    expect(upright.h).toBeCloseTo(flat.w, 6);
  });

  it("deska má kresbu posunutou o 22 px doleva a 16 nahoru", () => {
    const b = drawBounds(comp("breadboard-half", 0, 100, 100));
    expect(b.x).toBe(100 - 22);
    expect(b.y).toBe(100 - 16);
    expect(b.w).toBe(508);
    expect(b.h).toBe(256);
  });
});
