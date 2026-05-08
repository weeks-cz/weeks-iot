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
  pins: [
    { name: "anode",   dx: 0, dy: 0 },
    { name: "cathode", dx: 0, dy: 1 },
  ],
  spanX: 1, spanY: 1, scale: 0.5,
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
      { name: "5V",    dx: 7,  dy: 8 },
      { name: "3V3",   dx: 8,  dy: 8 },
      { name: "GND-2", dx: 9,  dy: 8 },
      { name: "GND-3", dx: 10, dy: 8 },
      { name: "VIN",   dx: 11, dy: 8 },
      { name: "RESET", dx: 12, dy: 8 },
      { name: "AREF",  dx: 13, dy: 8 },
    ],
    spanX: 16, spanY: 10, scale: 0.6,
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

export function getComponentSpec(type: ComponentType): ComponentSpec {
  const spec = COMPONENT_REGISTRY[type];
  if (!spec) throw new Error(`Unknown ComponentType: ${type}`);
  return spec;
}
