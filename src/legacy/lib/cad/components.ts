import type { WokwiTag } from "@legacy/types/wokwi-jsx";
import type { ComponentType } from "@legacy/types/cad";

export interface PinSpec {
  name: string;                              // logical pin name
  dx: number;                                // PITCH offset from component origin
  dy: number;
}

export interface ComponentSpec {
  type: ComponentType;
  label: string;                             // Czech UI label
  wokwiTag: WokwiTag;
  wokwiAttrs?: Record<string, string>;
  pins: PinSpec[];
  spanX: number;                             // PITCH units
  spanY: number;                             // PITCH units
  paletteIcon: string;                       // path under public/
  scale: number;                             // CSS transform scale to fit on PITCH grid
}

function generateBreadboardHalfPins(): PinSpec[] {
  const pins: PinSpec[] = [];
  // Power rails (top + bottom)
  for (let x = 0; x < 30; x++) {
    pins.push({ name: `top-+-${x}`, dx: x, dy: 0 });
    pins.push({ name: `top-−-${x}`, dx: x, dy: 1 });
    pins.push({ name: `bot-+-${x}`, dx: x, dy: 13 });
    pins.push({ name: `bot-−-${x}`, dx: x, dy: 14 });
  }
  // Bus rows above trench: rows A..E, columns 1..30
  for (const row of ["A", "B", "C", "D", "E"]) {
    const dy = 2 + ["A", "B", "C", "D", "E"].indexOf(row);
    for (let col = 1; col <= 30; col++) {
      pins.push({ name: `row-${row}-${col}`, dx: col - 1, dy });
    }
  }
  // Below trench F..J: rows F..J, columns 1..30
  for (const row of ["F", "G", "H", "I", "J"]) {
    const dy = 8 + ["F", "G", "H", "I", "J"].indexOf(row);
    for (let col = 1; col <= 30; col++) {
      pins.push({ name: `row-${row}-${col}`, dx: col - 1, dy });
    }
  }
  return pins;
}

const led = (color: string): Omit<ComponentSpec, "type" | "label" | "paletteIcon"> => ({
  wokwiTag: "wokwi-led",
  wokwiAttrs: { color },
  // scale=1.9: 40×50px → 76×95px; anode at (15,42)→(28.5,79.8)≈(2,5)×PITCH; cathode at (25,42)→(47.5,79.8)≈(3,5)×PITCH
  pins: [
    { name: "anode",   dx: 2, dy: 5 },
    { name: "cathode", dx: 3, dy: 5 },
  ],
  spanX: 4, spanY: 6, scale: 1.9,
});

export const COMPONENT_REGISTRY: Record<ComponentType, ComponentSpec> = {
  "arduino-uno": {
    type: "arduino-uno",
    label: "Arduino Uno",
    wokwiTag: "wokwi-arduino-uno",
    // scale=1.68: 275×202px → 462×340px; natural pin spacing ~9.5px → 16px (1 PITCH).
    // Top row at natural y=9 → dy=1. Bottom row at natural y=191.5 → dy=20.
    // x origin of first top pin (AREF) at natural x≈87 → dx=9.
    pins: [
      // Top header — digital pins (right side, D0=rightmost) + AREF/GND
      { name: "AREF",  dx: 11, dy:  1 },
      { name: "GND-1", dx: 12, dy:  1 },
      { name: "D13", dx: 13, dy: 1 }, { name: "D12", dx: 14, dy: 1 },
      { name: "D11", dx: 15, dy: 1 }, { name: "D10", dx: 16, dy: 1 },
      { name: "D9",  dx: 17, dy: 1 }, { name: "D8",  dx: 18, dy: 1 },
      // gap at dx=19 mirrors the physical gap between D8/D7 connector groups
      { name: "D7",  dx: 20, dy: 1 }, { name: "D6",  dx: 21, dy: 1 },
      { name: "D5",  dx: 22, dy: 1 }, { name: "D4",  dx: 23, dy: 1 },
      { name: "D3",  dx: 24, dy: 1 }, { name: "D2",  dx: 25, dy: 1 },
      { name: "D1",  dx: 26, dy: 1 }, { name: "D0",  dx: 27, dy: 1 },
      // Bottom header — power left cluster + analog right cluster
      { name: "IOREF", dx: 14, dy: 20 },
      { name: "RESET", dx: 15, dy: 20 },
      { name: "3V3",   dx: 16, dy: 20 },
      { name: "5V",    dx: 17, dy: 20 },
      { name: "GND-2", dx: 18, dy: 20 },
      { name: "GND-3", dx: 19, dy: 20 },
      { name: "VIN",   dx: 20, dy: 20 },
      // gap at dx=21
      { name: "A0", dx: 22, dy: 20 }, { name: "A1", dx: 23, dy: 20 },
      { name: "A2", dx: 24, dy: 20 }, { name: "A3", dx: 25, dy: 20 },
      { name: "A4", dx: 26, dy: 20 }, { name: "A5", dx: 27, dy: 20 },
    ],
    spanX: 29, spanY: 22, scale: 1.68,
    paletteIcon: "/cad/palette/arduino-uno.png",
  },
  "breadboard-half": {
    type: "breadboard-half",
    label: "Breadboard",
    wokwiTag: "wokwi-breadboard-half",
    pins: generateBreadboardHalfPins(),
    spanX: 30, spanY: 15, scale: 1.0,
    paletteIcon: "/cad/palette/breadboard-half.png",
  },
  "led-red":    { ...led("red"),    type: "led-red",    label: "LED červená", paletteIcon: "/cad/palette/led-red.png" },
  "led-yellow": { ...led("yellow"), type: "led-yellow", label: "LED žlutá",   paletteIcon: "/cad/palette/led-yellow.png" },
  "led-green":  { ...led("green"),  type: "led-green",  label: "LED zelená",  paletteIcon: "/cad/palette/led-green.png" },
  "led-blue":   { ...led("blue"),   type: "led-blue",   label: "LED modrá",   paletteIcon: "/cad/palette/led-blue.png" },
  "led-rgb": {
    type: "led-rgb", label: "LED RGB",
    wokwiTag: "wokwi-rgb-led",
    // scale=1.78: 42×73px → 75×130px; pins at R(8.5,44)→(1,5), COM(18,54)→(2,6), G(26.4,44)→(3,5), B(35.7,44)→(4,5)
    pins: [
      { name: "r",       dx: 1, dy: 5 },
      { name: "cathode", dx: 2, dy: 6 },
      { name: "g",       dx: 3, dy: 5 },
      { name: "b",       dx: 4, dy: 5 },
    ],
    spanX: 5, spanY: 8, scale: 1.78,
    paletteIcon: "/cad/palette/led-rgb.png",
  },
  "resistor-220": {
    type: "resistor-220", label: "Rezistor 220 Ω",
    wokwiTag: "wokwi-resistor",
    wokwiAttrs: { value: "220" },
    // scale=1.09: 59×11px → 64×12px; pin1(0,5.65)→(0,0), pin2(58.8,5.65)→(4,0); spacing 58.8×1.09≈64=4 PITCH
    pins: [{ name: "a", dx: 0, dy: 0 }, { name: "b", dx: 4, dy: 0 }],
    spanX: 4, spanY: 1, scale: 1.09,
    paletteIcon: "/cad/palette/resistor-220.png",
  },
  "pushbutton": {
    type: "pushbutton", label: "Tlačítko",
    wokwiTag: "wokwi-pushbutton",
    wokwiAttrs: { color: "red" },
    // scale=1.0: 67×45px; left pins at x=0→dx=0, right at x=67→dx=4; top y=13→dy=1, bottom y=32→dy=2
    pins: [
      { name: "1a", dx: 0, dy: 1 }, { name: "2a", dx: 4, dy: 1 },
      { name: "1b", dx: 0, dy: 2 }, { name: "2b", dx: 4, dy: 2 },
    ],
    spanX: 5, spanY: 3, scale: 1.0,
    paletteIcon: "/cad/palette/pushbutton.png",
  },
  "piezo-buzzer": {
    type: "piezo-buzzer", label: "Piezo buzzer",
    wokwiTag: "wokwi-buzzer",
    // scale=1.6: 64×76px; + at natural(27,84)→(43,134)≈(3,8)×PITCH; - at (37,84)→(59,134)≈(4,8)×PITCH
    pins: [{ name: "+", dx: 3, dy: 8 }, { name: "-", dx: 4, dy: 8 }],
    spanX: 7, spanY: 9, scale: 1.6,
    paletteIcon: "/cad/palette/piezo-buzzer.png",
  },
  "potentiometer": {
    type: "potentiometer", label: "Potenciometr",
    wokwiTag: "wokwi-potentiometer",
    // scale=1.6: 76×76px; pins at y=68.5→dy=7; GND(29)→dx=3, SIG(39)→dx=4, VCC(49)→dx=5; spacing 10px×1.6=16=1 PITCH
    pins: [
      { name: "terminal-a", dx: 3, dy: 7 },
      { name: "signal",     dx: 4, dy: 7 },
      { name: "terminal-b", dx: 5, dy: 7 },
    ],
    spanX: 8, spanY: 8, scale: 1.6,
    paletteIcon: "/cad/palette/potentiometer.png",
  },
  "photoresistor": {
    type: "photoresistor", label: "Fotorezistor",
    wokwiTag: "wokwi-photoresistor-sensor",
    // scale=1.78: 174×62px → 310×110px; all 4 pins at x=172→dx=19; VCC(y=16)→dy=2, GND(26)→dy=3, DO(35.8)→dy=4, AO(45.5)→dy=5
    pins: [
      { name: "vcc",  dx: 19, dy: 2 },
      { name: "gnd",  dx: 19, dy: 3 },
      { name: "dout", dx: 19, dy: 4 },
      { name: "aout", dx: 19, dy: 5 },
    ],
    spanX: 20, spanY: 7, scale: 1.78,
    paletteIcon: "/cad/palette/photoresistor.png",
  },
};

export function getComponentSpec(type: ComponentType): ComponentSpec {
  const spec = COMPONENT_REGISTRY[type];
  if (!spec) throw new Error(`Unknown ComponentType: ${type}`);
  return spec;
}
