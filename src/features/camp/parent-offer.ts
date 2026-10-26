import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCampCatchment } from "@/features/onboarding/queries";
import { campOfferFor, type CampOffer } from "./offer";

/**
 * Nabídka tábora pro přihlášeného rodiče — podle jeho kraje a spádu
 * z databáze. Jediné místo, kde se to čte: lobby, finále kurzu na stránce
 * lekce i /ucet tak nemůžou říkat každý něco jiného. Pravidla jsou
 * v `campOfferFor`; chybu dotazu hází dál, volající rozhodne, co bez karty.
 */
export async function parentCampOffer(parentId: string): Promise<CampOffer> {
  const supabase = await createClient();
  const [{ data: parent, error }, catchment] = await Promise.all([
    supabase.from("parents").select("region_code").eq("id", parentId).maybeSingle(),
    getCampCatchment(),
  ]);
  if (error) throw error;
  return campOfferFor({ regionCode: parent?.region_code ?? null, catchment, anonymous: false });
}
