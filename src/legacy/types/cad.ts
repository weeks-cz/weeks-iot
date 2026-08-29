export type ComponentType =
  | "arduino-uno"
  | "breadboard-half"
  | "led-red" | "led-yellow" | "led-green" | "led-blue" | "led-rgb"
  | "resistor-220"
  | "pushbutton"
  | "piezo-buzzer"
  | "potentiometer"
  | "photoresistor";

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  x: number;                                 // PITCH-aligned plane coords (px)
  y: number;
  rotation: 0 | 90 | 180 | 270;              // v1 always 0 — field reserved for forward-compat
}

export interface PinRef {
  compId: string;
  pinName: string;                           // e.g. "anode", "D13", "row-A-15"
}

export interface Wire {
  id: string;
  from: PinRef;
  to: PinRef;
  color?: "gray";                            // v1 always gray
}

export interface Circuit {
  comps: CircuitComponent[];
  wires: Wire[];
}
