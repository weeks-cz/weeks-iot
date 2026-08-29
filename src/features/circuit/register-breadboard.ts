// Registers a minimal wokwi-breadboard-half custom element.
// @wokwi/elements v1.9.2 does not include a breadboard component; this fallback
// renders a styled element that visually approximates a half-size solderless breadboard.
export function registerBreadboardHalf(): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get("wokwi-breadboard-half")) return;

  class WokwiBreadboardHalf extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      const shadow = this.attachShadow({ mode: "open" });

      const style = document.createElement("style");
      // 480×240 px = 30×15 PITCH units matching the ComponentSpec dimensions.
      // Hole grid uses radial-gradient at 16px pitch; background-position:8px 8px
      // centers each hole in its grid cell.
      style.textContent =
        ":host{display:block;width:480px;height:240px;position:relative;" +
        "box-sizing:border-box;border-radius:4px;overflow:hidden;border:1.5px solid #a09060;}" +
        ".board{width:100%;height:100%;background:#d0c098;position:relative;}" +
        ".s{position:absolute;left:0;right:0;" +
        "background-image:radial-gradient(circle,#4a3a1a 2.5px,transparent 2.5px);" +
        "background-size:16px 16px;background-position:8px 8px;}" +
        ".rp{background-color:rgba(180,60,60,0.22);}" +   // rail +
        ".rm{background-color:rgba(60,60,200,0.22);}" +   // rail -
        ".bd{background-color:#e4d8b4;}" +                // body rows
        ".tr{position:absolute;left:0;right:0;height:14px;top:113px;" +
        "background:#b8a870;border-top:1px solid #907840;border-bottom:1px solid #907840;}";

      const board = document.createElement("div");
      board.className = "board";

      // Each section: [className, top-px, height-px]
      const sections: [string, number, number][] = [
        ["s rp", 0,   16],   // top + rail
        ["s rm", 16,  16],   // top - rail
        ["s bd", 32,  80],   // rows A-E
        ["s bd", 128, 80],   // rows F-J
        ["s rp", 208, 16],   // bottom + rail
        ["s rm", 224, 16],   // bottom - rail
      ];

      for (const [cls, top, height] of sections) {
        const div = document.createElement("div");
        div.className = cls;
        div.style.top = `${top}px`;
        div.style.height = `${height}px`;
        board.appendChild(div);
      }

      // Center trough (no holes — overrides the body bg)
      const trough = document.createElement("div");
      trough.className = "tr";
      board.appendChild(trough);

      shadow.appendChild(style);
      shadow.appendChild(board);
    }
  }

  customElements.define("wokwi-breadboard-half", WokwiBreadboardHalf);
}
