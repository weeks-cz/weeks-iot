import { getComponentSpec } from "./components";
import { PITCH } from "./constants";
import type { CircuitComponent, ComponentType } from "./types";

/**
 * Jediné místo, kde se počítá poloha něčeho na ploše.
 *
 * ── Proč tu nejsou rozesety výpočty po souboru ─────────────────────────────
 * Pozice nožičky se dřív počítala na pěti místech (hit-test, placement,
 * nets, výřez, popisky). Každé místo mělo svou verzi `x + dx * PITCH`.
 * Jakmile přišlo otáčení, každá verze by musela umět otočit — a jedna
 * zapomenutá by ukazovala drátek na jiné místo, než kam dítě nožičku dalo.
 *
 * ── Jak se otáčí ───────────────────────────────────────────────────────────
 * Součástka je obdélník (`spanX × spanY` rozteč) s počátkem v levém horním
 * rohu. Otočení je otočení celého obdélníku kolem jeho středu. Pozice
 * bodu po otočení se proto počítá vzorcem: střed neotočeného obdélníku
 * přejde na střed otočeného, zbytek se rotuje. Pro čtvrtotáčky to dá
 * přesně celé násobky rozteče, takže nožička po otočení pořád leží na
 * dírce — pokud je počátek na mřížce, a ten se při otočení zarovnává.
 *
 * Kresba (Wokwi element) se otáčí týmž způsobem: viz `rotationTransform`.
 * Obě věci musí zůstat v souladu, jinak nožička visí vedle kresby.
 */

export type Rotation = 0 | 90 | 180 | 270;

export interface PinPos {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Otočení z dat, která mohla vzniknout dřív. Chybí nebo je divné → 0. */
export function normalizeRotation(value: unknown): Rotation {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}

/** Smí se součástka otáčet? Deska a Arduino ne — leží, jak leží. */
export function isRotatable(type: ComponentType): boolean {
  return getComponentSpec(type).rotatable !== false;
}

/** Rozměr obdélníku součástky v neotočeném stavu (px). */
function unrotatedSize(type: ComponentType): { w: number; h: number } {
  const spec = getComponentSpec(type);
  return { w: spec.spanX * PITCH, h: spec.spanY * PITCH };
}

/** Střed neotočené součástky, v px od jejího počátku. Střed otáčení. */
export function pivotOffset(type: ComponentType): PinPos {
  const { w, h } = unrotatedSize(type);
  return { x: w / 2, y: h / 2 };
}

/** Střed součástky po otočení, v px od jejího (nového) počátku. */
function rotatedCentre(type: ComponentType, rotation: Rotation): PinPos {
  const { w, h } = unrotatedSize(type);
  return rotation === 90 || rotation === 270 ? { x: h / 2, y: w / 2 } : { x: w / 2, y: h / 2 };
}

/**
 * Bod z NEOTOČENÉ součástky (px od počátku) → px od počátku po otočení.
 *
 * Otočí se kolem středu a střed se přesune na střed nového obdélníku.
 */
export function rotateOffset(type: ComponentType, rotation: Rotation, p: PinPos): PinPos {
  const c = pivotOffset(type);
  const u = p.x - c.x;
  const v = p.y - c.y;

  let x: number;
  let y: number;
  switch (rotation) {
    case 90:
      x = -v;
      y = u;
      break;
    case 180:
      x = -u;
      y = -v;
      break;
    case 270:
      x = v;
      y = -u;
      break;
    default:
      x = u;
      y = v;
  }

  const cr = rotatedCentre(type, rotation);
  return { x: cr.x + x, y: cr.y + y };
}

/** Bod z neotočené součástky na plochu, s ohledem na otočení. */
export function toPlane(comp: Pick<CircuitComponent, "type" | "x" | "y" | "rotation">, p: PinPos): PinPos {
  const rot = rotateOffset(comp.type, normalizeRotation(comp.rotation), p);
  return { x: comp.x + rot.x, y: comp.y + rot.y };
}

/** Klíč polohy na ploše — porovnává se přesně, souřadnice jsou celé násobky rozteče. */
export function positionKey(p: { x: number; y: number }): string {
  return `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`;
}

/** Kde na ploše leží pin součástky. Souřadnice jsou v ploše, ne na obrazovce. */
export function resolvePinPosition(comp: CircuitComponent, pinName: string): PinPos | null {
  const pin = getComponentSpec(comp.type).pins.find((p) => p.name === pinName);
  if (!pin) return null;

  return toPlane(comp, { x: pin.dx * PITCH, y: pin.dy * PITCH });
}

/**
 * Kresba v neotočených souřadnicích (px od počátku součástky).
 *
 * Wokwi prvek se kreslí na `visualOffset` a zvětšuje se o `scale`. Pokud
 * spec nezná přesnou velikost kresby (`box`), bere se rozpětí pinů — pro
 * zvýraznění a výřez je to dost, přesný rámeček ukazují jen prvky s `box`.
 */
export function drawBoxLocal(type: ComponentType): Box {
  const spec = getComponentSpec(type);
  const s = spec.scale;
  const vo = spec.visualOffset ?? { x: 0, y: 0 };
  if (spec.box) {
    return { x: vo.x * s, y: vo.y * s, w: spec.box.w * s, h: spec.box.h * s };
  }
  return { x: vo.x * s, y: vo.y * s, w: spec.spanX * PITCH, h: spec.spanY * PITCH };
}

/**
 * Kresba v ploše — obal kolem otočené kresby.
 *
 * Výřez, zásahy i rámeček výběru to berou odsud, ne z pinů: visualOffset
 * posouvá kresbu (u desky o 22 px), takže rozpětí pinů ji neobjímá.
 */
export function drawBounds(comp: CircuitComponent): Box {
  const b = drawBoxLocal(comp.type);
  const corners = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x, y: b.y + b.h },
    { x: b.x + b.w, y: b.y + b.h },
  ].map((p) => toPlane(comp, p));

  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

/**
 * Počátek součástky po otočení tak, aby střed zůstal na místě.
 *
 * Výsledek ještě není na mřížce — zarovnává ho volající (`snapToGrid`).
 * Pro lichý rozměr vyjde půl rozteče, a to je správně: nožičky pak leží
 * na mřížce i tak, protože se počítají od zaokrouhleného počátku.
 */
export function rotatedOrigin(
  comp: Pick<CircuitComponent, "type" | "x" | "y" | "rotation">,
  next: Rotation,
): PinPos {
  const centre = pivotOffset(comp.type);
  const cr = rotatedCentre(comp.type, next);
  return { x: comp.x + centre.x - cr.x, y: comp.y + centre.y - cr.y };
}

/**
 * CSS transformace, která otočí kresbu stejně jako `rotateOffset`.
 *
 * Kreslí se v neotočeném obdélníku s počátkem v (0,0) a tohle ho přesune
 * na střed nového obdélníku, otočí a vrátí zpátky. Výsledek je přesně
 * `rotateOffset`, takže kresba a nožičky sedí na sobě.
 */
export function rotationTransform(type: ComponentType, rotation: Rotation): string {
  const c = pivotOffset(type);
  const cr = rotatedCentre(type, rotation);
  return `translate(${cr.x}px, ${cr.y}px) rotate(${rotation}deg) translate(${-c.x}px, ${-c.y}px)`;
}
