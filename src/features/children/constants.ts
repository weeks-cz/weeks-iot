/**
 * Konstanty odděleně od akcí.
 *
 * Soubor s direktivou "use server" smí exportovat výhradně async funkce —
 * všechno ostatní shodí build hláškou „A 'use server' file can only export
 * async functions". Konstanty a typy proto patří vedle, ne dovnitř.
 */

/** Cookie s vybraným profilem. Je to volba, ne oprávnění. */
export const ACTIVE_CHILD_COOKIE = "ucebna.child";
