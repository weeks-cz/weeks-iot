// Registruje custom element wokwi-breadboard-half.
// @wokwi/elements breadboard nemá, takže si ho kreslíme sami — jako SVG,
// aby dírky byly ostré v každém zvětšení.

/** Rozteč dírek. Musí sedět s PITCH v constants.ts. */
const P = 16;
/** Okraj kresby kolem pole dírek — na písmena řad a čísla sloupců. */
const MARGIN_X = 22;
const MARGIN_Y = 8;

/**
 * ── Proč se to celé překreslilo ────────────────────────────────────────────
 * Původní verze kreslila dírky přes CSS gradient s posunem 8 px, tedy
 * O PŮL ROZTEČE VEDLE skutečných pinů. Každá nožička a každý drátek tak
 * přistály MEZI nakreslené dírky — a celé zapojování působilo rozbitě,
 * i když elektricky fungovalo.
 *
 * Teď platí: dírka k = pin k. Střed první dírky je v kresbě na
 * (MARGIN_X, MARGIN_Y) a spec breadboardu má visualOffset (−22, −8),
 * takže po posunu leží přesně na mřížkovém bodu komponenty.
 *
 * Vzhled je odkoukaný z Tinkercadu: písmena řad po obou stranách, čísla
 * sloupců po pěti, červená linka s plusy u kladné lišty, modrá s mínusy
 * u záporné. Dítě pak vidí stejnou desku, jakou má na táboře v ruce.
 */
export function registerBreadboardHalf(): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get("wokwi-breadboard-half")) return;

  class WokwiBreadboardHalf extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      const shadow = this.attachShadow({ mode: "open" });

      const width = 2 * MARGIN_X + 29 * P; // dírky dx 0..29
      const height = 2 * MARGIN_Y + 14 * P; // řádky dy 0..14

      const cx = (dx: number) => MARGIN_X + dx * P;
      const cy = (dy: number) => MARGIN_Y + dy * P;

      const holes: string[] = [];
      const hole = (dx: number, dy: number) =>
        holes.push(
          `<rect x="${cx(dx) - 3.2}" y="${cy(dy) - 3.2}" width="6.4" height="6.4" rx="1.6" fill="#3b3b3f"/>`,
        );

      /* Lišty: dy 0 (+) a 1 (−) nahoře, 13 (+) a 14 (−) dole. Skutečná
         deska má dírky po pěticích s mezerou, ale náš spec má pin v každém
         sloupci — kreslit mezery by znamenalo klikatelné piny bez dírek. */
      for (const dy of [0, 1, 13, 14]) {
        for (let dx = 0; dx < 30; dx++) hole(dx, dy);
      }

      /* Pole A–E (dy 2..6) a F–J (dy 8..12). */
      for (const dy of [2, 3, 4, 5, 6, 8, 9, 10, 11, 12]) {
        for (let dx = 0; dx < 30; dx++) hole(dx, dy);
      }

      const labels: string[] = [];
      const text = (x: number, y: number, t: string, fill = "#8a8f98", size = 8) =>
        labels.push(
          `<text x="${x}" y="${y}" font-family="ui-monospace,monospace" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="central">${t}</text>`,
        );

      /* Písmena řad po obou stranách — dítě podle nich hledá „řadu F". */
      const rows: Array<[string, number]> = [
        ["a", 2], ["b", 3], ["c", 4], ["d", 5], ["e", 6],
        ["f", 8], ["g", 9], ["h", 10], ["i", 11], ["j", 12],
      ];
      for (const [letter, dy] of rows) {
        text(MARGIN_X - 12, cy(dy), letter);
        text(width - MARGIN_X + 12, cy(dy), letter);
      }

      /* Čísla sloupců po pěti, v příkopu — jediné volné místo. */
      for (const col of [1, 5, 10, 15, 20, 25, 30]) {
        text(cx(col - 1), cy(7), String(col), "#7a7f88", 7.5);
      }

      /* Značení lišt: linka po celé délce + symboly na koncích. */
      const rails: string[] = [];
      const rail = (dy: number, color: string, sign: string, side: "above" | "below") => {
        const y = side === "above" ? cy(dy) - 8 : cy(dy) + 8;
        rails.push(
          `<line x1="${cx(0) - 6}" y1="${y}" x2="${cx(29) + 6}" y2="${y}" stroke="${color}" stroke-width="1.6"/>`,
        );
        for (const x of [cx(0) - 13, cx(29) + 13]) {
          rails.push(
            `<text x="${x}" y="${y}" font-family="ui-monospace,monospace" font-size="9" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="central">${sign}</text>`,
          );
        }
      };
      rail(0, "#d64545", "+", "above");
      rail(1, "#4467c4", "−", "below");
      rail(13, "#d64545", "+", "above");
      rail(14, "#4467c4", "−", "below");

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"
             viewBox="0 0 ${width} ${height}">
          <rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}"
                rx="6" fill="#f2f0eb" stroke="#c8c4ba" stroke-width="1.5"/>
          <rect x="2" y="${cy(7) - 8}" width="${width - 4}" height="16" fill="#e4e1da"/>
          ${rails.join("")}
          ${holes.join("")}
          ${labels.join("")}
        </svg>`;

      const style = document.createElement("style");
      style.textContent = `:host{display:block;width:${width}px;height:${height}px}`;

      const wrap = document.createElement("div");
      wrap.innerHTML = svg;

      shadow.appendChild(style);
      shadow.appendChild(wrap.firstElementChild as SVGElement);
    }
  }

  customElements.define("wokwi-breadboard-half", WokwiBreadboardHalf);
}
