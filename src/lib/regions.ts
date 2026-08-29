/**
 * Kraje a segmentace publika.
 *
 * Kraj je jediné, co rozhoduje, jestli rodič uvidí kartu letního termínu,
 * nebo čekačku na město. Bez toho nejde oddělit publikum na tábor
 * (Praha + Středočeský + Karlovarsko) od publika na předplatné (zbytek ČR)
 * ani stavět čekací listinu měst.
 *
 * Zdroj pravdy o spádu je sloupec `regions.is_camp_catchment` v databázi —
 * rozšíření na další kraj je pak UPDATE, ne nasazení. Tenhle soubor drží
 * jen seznam kódů (ten se nemění) a čistou logiku segmentu, aby šla
 * otestovat bez databáze.
 */

export const REGION_CODES = [
  "CZ-PR",
  "CZ-ST",
  "CZ-KA",
  "CZ-JC",
  "CZ-PL",
  "CZ-US",
  "CZ-LI",
  "CZ-KR",
  "CZ-PA",
  "CZ-VY",
  "CZ-JM",
  "CZ-OL",
  "CZ-ZL",
  "CZ-MO",
] as const;

export type RegionCode = (typeof REGION_CODES)[number];

/** Fallback pro případ, kdy číselník z databáze není po ruce (SSG, testy). */
export const REGION_NAMES: Record<RegionCode, string> = {
  "CZ-PR": "Praha",
  "CZ-ST": "Středočeský kraj",
  "CZ-KA": "Karlovarský kraj",
  "CZ-JC": "Jihočeský kraj",
  "CZ-PL": "Plzeňský kraj",
  "CZ-US": "Ústecký kraj",
  "CZ-LI": "Liberecký kraj",
  "CZ-KR": "Královéhradecký kraj",
  "CZ-PA": "Pardubický kraj",
  "CZ-VY": "Kraj Vysočina",
  "CZ-JM": "Jihomoravský kraj",
  "CZ-OL": "Olomoucký kraj",
  "CZ-ZL": "Zlínský kraj",
  "CZ-MO": "Moravskoslezský kraj",
};

/**
 * Výchozí spád k 29. 8. 2026.
 *
 * Dokument říká „Praha a Karlovarsko". Středočeský je tu navíc schválně:
 * příměstský tábor se dojíždí denně a Středočeši do Prahy dojíždějí, takže
 * pro ně je karta termínu nabídka, ne šum. Rozhodl Lukáš 29. 8.
 *
 * Používá se jen tam, kde číselník z DB není — živá pravda je v databázi.
 */
export const DEFAULT_CAMP_CATCHMENT: readonly RegionCode[] = ["CZ-PR", "CZ-ST", "CZ-KA"];

/** Co rodič uvidí na konci lekce. */
export type AudienceSegment = "camp" | "waitlist";

export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === "string" && (REGION_CODES as readonly string[]).includes(value);
}

export function regionName(code: RegionCode): string {
  return REGION_NAMES[code];
}

/**
 * Segment publika podle kraje.
 *
 * `catchment` se předává schválně: v aplikaci přichází z databáze, v testech
 * z konstanty. Kdyby si funkce spád načítala sama, nešlo by ji otestovat
 * bez databáze a rozšíření spádu by vyžadovalo nasazení.
 */
export function segmentForRegion(
  code: RegionCode | null | undefined,
  catchment: readonly string[] = DEFAULT_CAMP_CATCHMENT,
): AudienceSegment {
  if (!code) return "waitlist";
  return catchment.includes(code) ? "camp" : "waitlist";
}

/** Seznam pro select, seřazený tak, aby spád byl nahoře. */
export function regionOptions(
  catchment: readonly string[] = DEFAULT_CAMP_CATCHMENT,
): Array<{ code: RegionCode; name: string; isCatchment: boolean }> {
  return REGION_CODES.map((code) => ({
    code,
    name: REGION_NAMES[code],
    isCatchment: catchment.includes(code),
  })).sort((a, b) => {
    if (a.isCatchment !== b.isCatchment) return a.isCatchment ? -1 : 1;
    return a.name.localeCompare(b.name, "cs");
  });
}
