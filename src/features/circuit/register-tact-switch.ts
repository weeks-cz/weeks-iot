// Registruje custom element weeks-tact-switch: tlačítko 6×6 mm se čtyřmi nožičkami.
// Wokwi tlačítko má nožičky daleko od sebe a po otočení by vypadalo jako jiná
// součástka, proto si ho kreslíme sami — přesně v rozích čtverce 2 rozteče.

/** Kresba v px (scale 1). Nožičky jsou na (14,14), (46,14), (14,46), (46,46). */
export const TACT_SWITCH_SIZE = 60;
const LEG = 14;
const LEG_SPAN = 32;

/**
 * Tlačítko drží jen tehdy, dokud ho držíš. `pressed` přichází zvenku
 * (builder) a překreslí čepičku — dole je tmavší a menší.
 */
export function registerTactSwitch(): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get("weeks-tact-switch")) return;

  class WeeksTactSwitch extends HTMLElement {
    private isDown = false;
    private root: ShadowRoot | null = null;

    connectedCallback() {
      if (!this.root) this.root = this.attachShadow({ mode: "open" });
      this.render();
    }

    set pressed(value: boolean) {
      this.isDown = Boolean(value);
      this.render();
    }

    get pressed(): boolean {
      return this.isDown;
    }

    private render() {
      if (!this.root) return;

      const legPoints: Array<[number, number]> = [
        [LEG, LEG], [LEG + LEG_SPAN, LEG], [LEG, LEG + LEG_SPAN], [LEG + LEG_SPAN, LEG + LEG_SPAN],
      ];
      /* Nožička vede od svého bodu do rohu tělíska. Konce sedí přesně na
         dírkách, takže je vidět, že stojí na mřížce. */
      const bodyCorner = (x: number, y: number): [number, number] => [x < 30 ? 19 : 41, y < 30 ? 19 : 41];
      const legs = legPoints
        .map(([x, y]) => {
          const [bx, by] = bodyCorner(x, y);
          return `<line x1="${x}" y1="${y}" x2="${bx}" y2="${by}" stroke="#aeb3be" stroke-width="3" stroke-linecap="round"/>`;
        })
        .join("");

      const down = this.isDown;
      const capR = down ? 6 : 7.5;
      const capFill = down ? "#a83232" : "#d64545";

      this.root.innerHTML = `
        <style>:host{display:block;width:${TACT_SWITCH_SIZE}px;height:${TACT_SWITCH_SIZE}px}</style>
        <svg xmlns="http://www.w3.org/2000/svg" width="${TACT_SWITCH_SIZE}" height="${TACT_SWITCH_SIZE}" viewBox="0 0 ${TACT_SWITCH_SIZE} ${TACT_SWITCH_SIZE}">
          ${legs}
          <rect x="19" y="19" width="22" height="22" rx="3" fill="#2b2f3a" stroke="#14161d" stroke-width="1"/>
          <circle cx="30" cy="30" r="${capR}" fill="${capFill}" stroke="#6e1c1c" stroke-width="1"/>
          ${down ? "" : '<circle cx="28" cy="27.5" r="2.4" fill="#fff" opacity="0.35"/>'}
        </svg>`;
    }
  }

  customElements.define("weeks-tact-switch", WeeksTactSwitch);
}
