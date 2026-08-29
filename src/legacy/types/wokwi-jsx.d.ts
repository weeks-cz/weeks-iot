import type React from "react";

/**
 * JSX typy pro custom elementy z @wokwi/elements.
 *
 * POZOR na React 19: `JSX` už není globální namespace. @types/react 19 ho
 * deklaruje uvnitř modulu "react", takže `declare global { namespace JSX }`
 * se sice přeloží, ale TSX ho při rozlišování elementů vůbec nevidí — a
 * hlásí "Property 'wokwi-led' does not exist" i pro tagy, které v seznamu
 * jsou. Balíček @wokwi/elements má stejný problém: augmentuje globální JSX
 * podle React 18. Proto se augmentace musí psát do modulu "react".
 */

type WokwiCommon = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

/** Tagy, které CAD knihovna skutečně vykresluje. Rozšiřuje se s paletou součástek. */
export type WokwiTag =
  | "wokwi-led"
  | "wokwi-rgb-led"
  | "wokwi-resistor"
  | "wokwi-pushbutton"
  | "wokwi-buzzer"
  | "wokwi-potentiometer"
  | "wokwi-photoresistor-sensor"
  | "wokwi-arduino-uno"
  | "wokwi-breadboard-half";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wokwi-led": WokwiCommon & { color?: string; brightness?: string | number; value?: string };
      "wokwi-rgb-led": WokwiCommon;
      "wokwi-resistor": WokwiCommon & { value?: string };
      "wokwi-pushbutton": WokwiCommon & { color?: string };
      "wokwi-buzzer": WokwiCommon;
      "wokwi-potentiometer": WokwiCommon;
      "wokwi-photoresistor-sensor": WokwiCommon & { value?: string | number };
      "wokwi-arduino-uno": WokwiCommon;
      "wokwi-breadboard-half": WokwiCommon;
    }
  }
}
