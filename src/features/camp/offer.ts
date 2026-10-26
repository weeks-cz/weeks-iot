import { CAMP_CITIES, campCityForRegion, type CampCity } from "@/lib/camp-offer";
import { segmentForRegion, type RegionCode } from "@/lib/regions";

/**
 * Nabídka tábora — jedno rozhodnutí pro lobby, finále kurzu i /ucet.
 *
 * `null` = nenabízet nic. `open` = dá se přihlásit, `soon` = termíny
 * připravujeme. `city: null` znamená obecnou nabídku pro oba spády.
 * Bez dat a cen: ty žijí jen na webu táborů.
 */
export type CampOffer = { kind: "open" | "soon"; city: CampCity | null } | null;

export function campOfferFor(
  input: { regionCode: string | null; catchment: readonly string[]; anonymous: boolean },
  cities: Record<CampCity, { prihlasky: boolean }> = CAMP_CITIES,
): CampOffer {
  const anyOpen = Object.values(cities).some((c) => c.prihlasky);
  const general: CampOffer = anyOpen ? { kind: "open", city: null } : null;

  if (input.anonymous) return general;
  if (segmentForRegion(input.regionCode as RegionCode | null, input.catchment) !== "camp") {
    return null;
  }

  const city = campCityForRegion(input.regionCode);
  if (!city) return general;
  return { kind: cities[city].prihlasky ? "open" : "soon", city };
}
