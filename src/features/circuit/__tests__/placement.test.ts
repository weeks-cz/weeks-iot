import { describe, expect, it } from "vitest";
import { grabAnchor, landing } from "../placement";
import { PITCH } from "../constants";
import type { Circuit } from "../types";

/**
 * Kam součástka padne, když ji dítě táhne.
 *
 * Nahlášeno z provozu: LED se při tahu nad breadboardem vznášela nožičkami
 * mezi dírkami a „zapadla" až po puštění. Dítě tak mířilo naslepo — přesně
 * to, co má náhled odstranit.
 */

const board: Circuit = {
  comps: [{ id: "bb", type: "breadboard-half", x: 0, y: 0, rotation: 0 }],
  wires: [],
};

describe("úchop", () => {
  it("drží součástku uprostřed, ne za levý horní roh", () => {
    /* LED je 4 × 6 roztečí. */
    expect(grabAnchor("led-red")).toEqual({ x: 2 * PITCH, y: 3 * PITCH });
  });
});

describe("magnet nad breadboardem", () => {
  it("nad dírkami přicvakne na mřížku, takže nožičky sedí v dírkách už během tahu", () => {
    /* Rezistor s nožičkou na řadě A (dy=2), o pár pixelů vedle. */
    const hit = landing(board, "resistor-220", { x: 5, y: 2 * PITCH - 3 });
    expect(hit.at).toEqual({ x: 0, y: 2 * PITCH });
    expect(hit.snapped).toBe(true);
    expect(hit.points.length).toBeGreaterThan(0);
    expect(hit.points.every((p) => p.ok)).toBe(true);
  });

  it("mimo desku jede plynule s prstem", () => {
    const raw = { x: 2003.5, y: 1999.2 };
    const hit = landing(board, "resistor-220", raw);
    expect(hit.at).toEqual(raw);
    expect(hit.snapped).toBe(false);
    expect(hit.points).toEqual([]);
  });

  it("bez desky na ploše nic nepřitahuje", () => {
    const empty: Circuit = { comps: [], wires: [] };
    const raw = { x: 13, y: 7 };
    expect(landing(empty, "led-red", raw).at).toEqual(raw);
  });

  it("dírka obsazená jinou nožičkou je červená", () => {
    /* Do jedné dírky se na skutečné desce dvě nožičky nevejdou. */
    const taken: Circuit = {
      comps: [
        ...board.comps,
        { id: "r1", type: "resistor-220", x: 0, y: 2 * PITCH, rotation: 0 },
      ],
      wires: [],
    };
    const hit = landing(taken, "resistor-220", { x: 0, y: 2 * PITCH });
    expect(hit.points.some((p) => !p.ok)).toBe(true);
  });

  it("součástka, kterou táhnu, si dírky neblokuje sama", () => {
    const self: Circuit = {
      comps: [
        ...board.comps,
        { id: "r1", type: "resistor-220", x: 0, y: 2 * PITCH, rotation: 0 },
      ],
      wires: [],
    };
    const hit = landing(self, "resistor-220", { x: 2, y: 2 * PITCH + 1 }, { excludeId: "r1" });
    expect(hit.snapped).toBe(true);
    expect(hit.points.every((p) => p.ok)).toBe(true);
  });
});
