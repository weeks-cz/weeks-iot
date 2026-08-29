import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_CAMP_CATCHMENT,
  REGION_NAMES,
  REGION_CODES,
  type RegionCode,
} from "@/lib/regions";

export interface RegionOption {
  code: string;
  name: string;
  isCatchment: boolean;
}

/**
 * Číselník krajů.
 *
 * Živá pravda o spádu je v databázi — rozšíření na další kraj je pak UPDATE,
 * ne nasazení. Když je tabulka nedostupná, padá se na konstantu v kódu:
 * registrace bez seznamu krajů nejde dokončit vůbec, takže výpadek číselníku
 * nesmí zablokovat celý onboarding.
 */
export async function getRegionOptions(): Promise<RegionOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("regions")
      .select("code, name, is_camp_catchment, sort_order")
      .order("sort_order");

    if (error || !data?.length) return fallbackRegions();

    return data.map((row) => ({
      code: row.code,
      name: row.name,
      isCatchment: row.is_camp_catchment,
    }));
  } catch {
    return fallbackRegions();
  }
}

function fallbackRegions(): RegionOption[] {
  return REGION_CODES.map((code: RegionCode) => ({
    code,
    name: REGION_NAMES[code],
    isCatchment: DEFAULT_CAMP_CATCHMENT.includes(code),
  }));
}

/** Spádové kraje pro rozhodnutí karta termínu vs. čekačka. */
export async function getCampCatchment(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("regions")
      .select("code")
      .eq("is_camp_catchment", true);

    if (!data?.length) return [...DEFAULT_CAMP_CATCHMENT];
    return data.map((r) => r.code);
  } catch {
    return [...DEFAULT_CAMP_CATCHMENT];
  }
}
