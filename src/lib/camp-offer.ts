import type { RegionCode } from "./regions";

/**
 * Na který tábor učebna posílá rodiče ze spádu.
 *
 * Spád (kdo vůbec uvidí kartu tábora) je v databázi, `regions.is_camp_catchment`.
 * Tady je jen to, co z databáze nevyčteš: do kterého města kraj dojíždí
 * a jestli se tam už dá přihlásit. Středočeský jezdí do Prahy (rozhodnutí
 * 29. 8., viz `DEFAULT_CAMP_CATCHMENT`).
 *
 * Termíny, ceny a stav turnusů jsou ve weeks-web (`src/lib/turnusy.ts`) —
 * sem se schválně neopisují, karta by zastarala dřív než web. Učebna drží
 * jediný bit na město: otevřené přihlašování ano/ne. Až Praha přejde na
 * `otevreno`, přepne se `prihlasky` tady.
 */
export type CampCity = "karlovy-vary" | "praha";

const CAMP_CITY_BY_REGION: Partial<Record<RegionCode, CampCity>> = {
  "CZ-KA": "karlovy-vary",
  "CZ-PR": "praha",
  "CZ-ST": "praha",
};

/**
 * `prihlasky` přepíná ručně ten, kdo na weeks.cz otevírá nebo zavírá turnus
 * (weeks-web `src/lib/turnusy.ts`): ve stejné chvíli přepne bit i tady.
 * Nic ho nehlídá — když se zapomene, karta lže o stavu přihlašování.
 */
/*
 * `nabidka` říká, na co se ve městě přihlašuje — dokud byl jediný tábor
 * chytrých technologií, stála ve větě karty natvrdo „skutečné Arduino
 * a 3D tisk". Od 20. 11. 2026 jsou v Praze otevřené tři tábory (weeks-web
 * `praha-2027-herni-vyvoj`, `praha-2027-3d-tisk`, `praha-2027-umela-inteligence`)
 * a věta je jmenuje všechny – krátkými názvy táborů z weeks-web.
 */
export const CAMP_CITIES: Record<
  CampCity,
  { locative: string; prihlasky: boolean; nabidka: string }
> = {
  "karlovy-vary": {
    locative: "v Karlových Varech",
    prihlasky: true,
    nabidka: "skutečné Arduino a 3D tisk",
  },
  praha: {
    locative: "v Praze",
    prihlasky: true,
    nabidka: "3D tisk a elektronika, vlastní hra v enginu Godot nebo AI a chytrá elektronika",
  },
};

/** Město tábora pro kraj. Kraj ve spádu bez města (rozšířený spád v DB) → null. */
export function campCityForRegion(code: string | null | undefined): CampCity | null {
  if (!code) return null;
  return CAMP_CITY_BY_REGION[code as RegionCode] ?? null;
}

/**
 * Odkaz na tábory. S městem rovnou na jeho výpis — u Karlových Varů na
 * termíny s přihláškou, u Prahy na kartu s formulářem „dejte mi vědět“.
 * Bez města celý výpis /tabory.
 */
export function campUrl(city: CampCity | null, utmQuery: string): string {
  const base = "https://weeks.cz/tabory";
  return city ? `${base}?mesto=${city}&${utmQuery}` : `${base}?${utmQuery}`;
}
