import type React from "react";

type WokwiCommon = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "wokwi-led":              WokwiCommon & { color?: string; brightness?: string | number; value?: string };
      "wokwi-led-rgb":          WokwiCommon;
      "wokwi-resistor":         WokwiCommon & { value?: string };
      "wokwi-pushbutton":       WokwiCommon & { color?: string };
      "wokwi-buzzer":           WokwiCommon;
      "wokwi-potentiometer":    WokwiCommon;
      "wokwi-photoresistor-sensor": WokwiCommon & { value?: string | number };
      "wokwi-arduino-uno":      WokwiCommon;
      "wokwi-breadboard-half":  WokwiCommon;
    }
  }
}

export {};
