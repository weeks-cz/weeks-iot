/**
 * Maps wokwi component logical pin names → CSS selectors for shadow DOM access.
 *
 * CRITICAL FINDING from @wokwi/elements source inspection (v1.9.2):
 * The wokwi/elements package does NOT render pins as individually queryable DOM elements.
 * Instead, components expose a `pinInfo` property that contains pin metadata (name, x, y coords).
 * The actual pin visualization is embedded in SVG, but pins are not marked with data attributes,
 * IDs, or queryable selectors.
 *
 * APPROACH:
 * Since direct DOM queries won't work, we use coordinate-based lookup via pinInfo.
 * The wire engine (Task 15) must use:
 *   const pinInfo = element.pinInfo.find(p => p.name === logicalPinName);
 *   const pinWorldPos = { x: element.x + pinInfo.x, y: element.y + pinInfo.y };
 *
 * Selectors below are PLACEHOLDERS documenting the intended pin mapping.
 * They serve as documentation for the wire engine and may be used in future
 * versions if wokwi/elements changes its architecture to expose DOM nodes.
 * For now, the pin resolver (Task 15) must access element.pinInfo directly.
 */

export type PinSelectorMap = Record<string, string>;

/**
 * PLACEHOLDER selectors - see above. Not used in current wokwi/elements.
 * Real implementation uses element.pinInfo array lookup.
 */
export const PIN_SELECTORS: Record<string, PinSelectorMap> = {
  // Simple 2-pin LED
  "wokwi-led": {
    anode: "[data-pin-name='A']",     // pinInfo[0].name = 'A'
    cathode: "[data-pin-name='C']",   // pinInfo[1].name = 'C'
  },

  // RGB LED with 4 pins
  "wokwi-led-rgb": {
    r: "[data-pin-name='R']",         // pinInfo[0].name = 'R'
    cathode: "[data-pin-name='COM']", // pinInfo[1].name = 'COM'
    g: "[data-pin-name='G']",         // pinInfo[2].name = 'G'
    b: "[data-pin-name='B']",         // pinInfo[3].name = 'B'
  },

  // 2-pin resistor
  "wokwi-resistor": {
    a: "[data-pin-name='1']",         // pinInfo[0].name = '1'
    b: "[data-pin-name='2']",         // pinInfo[1].name = '2'
  },

  // 4-pin pushbutton (2x2 matrix)
  "wokwi-pushbutton": {
    "1a": "[data-pin-name='1.l']",    // pinInfo[0].name = '1.l'
    "2a": "[data-pin-name='2.l']",    // pinInfo[1].name = '2.l'
    "1b": "[data-pin-name='1.r']",    // pinInfo[2].name = '1.r'
    "2b": "[data-pin-name='2.r']",    // pinInfo[3].name = '2.r'
  },

  // 2-pin buzzer (piezo)
  "wokwi-buzzer": {
    "1": "[data-pin-name='1']",       // pinInfo[0].name = '1'
    "2": "[data-pin-name='2']",       // pinInfo[1].name = '2'
  },

  // 3-pin potentiometer
  "wokwi-potentiometer": {
    "gnd": "[data-pin-name='GND']",   // pinInfo[0].name = 'GND'
    "signal": "[data-pin-name='SIG']", // pinInfo[1].name = 'SIG'
    "vcc": "[data-pin-name='VCC']",   // pinInfo[2].name = 'VCC'
  },

  // 4-pin photoresistor sensor (KY-018 style)
  "wokwi-photoresistor-sensor": {
    vcc: "[data-pin-name='VCC']",     // pinInfo[0].name = 'VCC'
    gnd: "[data-pin-name='GND']",     // pinInfo[1].name = 'GND'
    "do": "[data-pin-name='DO']",     // pinInfo[2].name = 'DO' (digital out)
    ao: "[data-pin-name='AO']",       // pinInfo[3].name = 'AO' (analog out)
  },

  // Arduino Uno: 30 pins (D0-D13 digital, A0-A5 analog, power rails)
  "wokwi-arduino-uno": {
    // Digital pins (top row)
    D0: "[data-pin-name='0']",        // RX
    D1: "[data-pin-name='1']",        // TX
    D2: "[data-pin-name='2']",
    D3: "[data-pin-name='3']",
    D4: "[data-pin-name='4']",
    D5: "[data-pin-name='5']",
    D6: "[data-pin-name='6']",
    D7: "[data-pin-name='7']",
    D8: "[data-pin-name='8']",
    D9: "[data-pin-name='9']",
    D10: "[data-pin-name='10']",
    D11: "[data-pin-name='11']",
    D12: "[data-pin-name='12']",
    D13: "[data-pin-name='13']",
    // Right side
    AREF: "[data-pin-name='AREF']",
    GND1: "[data-pin-name='GND.1']",
    IOREF: "[data-pin-name='IOREF']",
    RESET: "[data-pin-name='RESET']",
    "3V3": "[data-pin-name='3.3V']",
    "5V": "[data-pin-name='5V']",
    GND2: "[data-pin-name='GND.2']",
    GND3: "[data-pin-name='GND.3']",
    VIN: "[data-pin-name='VIN']",
    // Analog pins (bottom row)
    A0: "[data-pin-name='A0']",
    A1: "[data-pin-name='A1']",
    A2: "[data-pin-name='A2']",
    A3: "[data-pin-name='A3']",
    A4: "[data-pin-name='A4']",
    A5: "[data-pin-name='A5']",
    "A4.2": "[data-pin-name='A4.2']", // I2C SDA (alternate)
    "A5.2": "[data-pin-name='A5.2']", // I2C SCL (alternate)
  },

  // Breadboard half - many pins using standard notation (A1-J30)
  "wokwi-breadboard-half": {
    // NOTE: Breadboard pins follow alphanumeric grid: A1, A2, ..., J30
    // These are PLACEHOLDERS for the first few columns.
    // Full breadboard has 5 rows (A-E, or A-J for full) × 30 columns.
    // Each pin would be: "[data-pin='${ROW}${COL}']" e.g. "[data-pin='A1']"
    // For now, we provide a pattern example:
    A1: "[data-pin='A1']",
    A2: "[data-pin='A2']",
    A3: "[data-pin='A3']",
    B1: "[data-pin='B1']",
    B2: "[data-pin='B2']",
    B3: "[data-pin='B3']",
    C1: "[data-pin='C1']",
    C2: "[data-pin='C2']",
    C3: "[data-pin='C3']",
    // ... continue for all 5 rows × 30 columns (A1-E30)
    // Implementation: generate dynamically if breadboard is used extensively
  },
};

/**
 * Helper: get the pinInfo structure directly from a wokwi element.
 * Since DOM selectors don't work, the wire engine uses this approach:
 *
 * @example
 *   const el = componentEl as any; // wokwi component
 *   const pinInfo = el.pinInfo.find(p => p.name === 'D5');
 *   const worldPos = {
 *     x: componentEl.offsetLeft + pinInfo.x,
 *     y: componentEl.offsetTop + pinInfo.y,
 *   };
 *
 * NOTE: This must be in Task 15 (pin-position-resolver.ts).
 * DO NOT try to use PIN_SELECTORS with shadowRoot.querySelector() directly.
 */
export function resolvePinPosition(
  componentEl: HTMLElement,
  pinName: string,
): { x: number; y: number } | null {
  const el = componentEl as any;
  if (!el.pinInfo || !Array.isArray(el.pinInfo)) {
    return null;
  }

  const pin = el.pinInfo.find((p: any) => p.name === pinName);
  if (!pin) {
    return null;
  }

  // Return relative coordinates; caller must add componentEl's world position
  return { x: pin.x, y: pin.y };
}
