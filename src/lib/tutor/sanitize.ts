/**
 * Vstupní limity a sanitizace pro AI tutora.
 * Čistá logika bez I/O — bezpečnostní vrstva mezi dítětem a modelem.
 */

export const LIMITS = {
  /** Max délka jedné zprávy od dítěte (znaky). */
  userMsgLen: 1000,
  /** Max délka kódu dítěte vkládaného do kontextu. */
  code: 4000,
  /** Max počet zpráv v jedné konverzaci, které pošleme modelu. */
  maxMessages: 24,
} as const;

/** Zkrátí text na max znaků (bez chyby u kratšího). */
export function clampText(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * Odstraní ASCII řídicí znaky kromě tabulátoru (9) a nového řádku (10).
 * Brání skrytým znakům / prompt-injection trikům přes neviditelné byty.
 * Implementováno přes kódy znaků, aby ve zdrojáku nebyly žádné řídicí byty.
 */
export function stripControlChars(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const isKeptWhitespace = c === 9 || c === 10; // \t, \n
    const isPrintable = c >= 32 && c !== 127;
    if (isKeptWhitespace || isPrintable) out += text[i];
  }
  return out;
}

/** Bezpečná sanitizace volného textu: zahodí nestring, ořeže řídicí znaky, trim, clamp. */
export function sanitizeText(text: unknown, max: number): string {
  if (typeof text !== "string") return "";
  return clampText(stripControlChars(text).trim(), max);
}
