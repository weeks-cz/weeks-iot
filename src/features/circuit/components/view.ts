import { ZOOM_MAX, ZOOM_MIN } from "../constants";
import { drawBounds } from "../pins";
import type { Circuit } from "../types";

/**
 * Výřez na plochu: zvětšení a posun, a přepočty mezi obrazovkou a plochou.
 *
 * Plocha sedí v zobrazení na `PLANE_OFFSET` + posun, a škáluje se kolem
 * svého počátku. Bod plochy `p` je na obrazovce v `PLANE_OFFSET + pan + p·zoom`.
 * Všechno tady je čisté, aby šlo testovat bez prohlížeče.
 */

/** Plocha je v CSS na left/top 2000; posun výřezu je vůči tomuhle. */
export const PLANE_OFFSET = 2000;

/** Kolik pixelů obvodu musí zůstat vidět při posunu. */
const KEEP_VISIBLE = 60;

export interface View {
  zoom: number;
  pan: { x: number; y: number };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** Bod na obrazovce (vůči výřezu) → bod plochy. */
export function screenToPlane(
  view: View,
  screen: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: (screen.x - PLANE_OFFSET - view.pan.x) / view.zoom,
    y: (screen.y - PLANE_OFFSET - view.pan.y) / view.zoom,
  };
}

/**
 * Nové zvětšení, při kterém zůstane bod pod kurzorem na místě.
 *
 * Zoom kolečkem se nemá „utíkat" ke počátku plochy — dítě míří na jednu
 * dírku a ta se mu posune pryč.
 */
export function zoomAt(
  view: View,
  screen: { x: number; y: number },
  nextZoom: number,
): View {
  const zoom = clampZoom(nextZoom);
  const p = screenToPlane(view, screen);
  return {
    zoom,
    pan: {
      x: screen.x - PLANE_OFFSET - p.x * zoom,
      y: screen.y - PLANE_OFFSET - p.y * zoom,
    },
  };
}

/**
 * Kolik se zvětší nebo zmenší po jednom kroku kolečka.
 *
 * Myš posílá skoky po stovce pixelů, trackpad po drobnostech. Exponenciála
 * dává při stejném kroku stejnou změnu v procentech, takže se oba chovají
 * podobně a trackpad nevyletí do krajnosti jedním švihnutím.
 */
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const dy = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-dy * 0.0015);
}

/** Obal všeho, co je na ploše, v souřadnicích plochy. */
export function contentBounds(circuit: Circuit): Box | null {
  if (circuit.comps.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const comp of circuit.comps) {
    const b = drawBounds(comp);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Posun, který nenechá obvod ztratit za okrajem.
 *
 * Obvod smí z výřezu vyjet, jen aby zůstalo vidět aspoň kus. Bez tohohle
 * jde plocha odtáhnout do prázdna a dítě pak hledá, kam se obvod poděl.
 * Volné místo kolem obvodu je tím zaručené v každém směru.
 */
export function clampPan(
  pan: { x: number; y: number },
  zoom: number,
  content: Box | null,
  viewport: { width: number; height: number },
): { x: number; y: number } {
  if (viewport.width <= 0 || viewport.height <= 0) return pan;

  const box = content ?? { x: 0, y: 0, w: 0, h: 0 };
  const axis = (value: number, min: number, max: number, size: number) => {
    /* Obsah se smí posunout tak, aby jeho krajní bod zůstal aspoň
       KEEP_VISIBLE od okraje. */
    const low = KEEP_VISIBLE - PLANE_OFFSET - max * zoom;
    const high = size - KEEP_VISIBLE - PLANE_OFFSET - min * zoom;
    if (low > high) return (low + high) / 2;
    return Math.min(high, Math.max(low, value));
  };

  return {
    x: axis(pan.x, box.x, box.x + box.w, viewport.width),
    y: axis(pan.y, box.y, box.y + box.h, viewport.height),
  };
}
