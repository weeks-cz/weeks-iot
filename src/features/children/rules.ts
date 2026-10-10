import type { AccountType } from "@/lib/supabase/types";
import { needsParentalConsent } from "@/features/onboarding/schema";

/**
 * Pravidla pro přidání dítěte — čistě, bez databáze.
 *
 * Dvě věci: kdo smí založit profil mladšího 15 let a kdo k němu musí dát
 * souhlas. Účet „spravuje sám“ (od 15 let) nesmí zakládat profily pod
 * 15 let: souhlas za takové dítě by nemohl dát nikdo, kdo to dává za sebe.
 * Účet zákonného zástupce může založit kohokoli, ale pod 15 let musí
 * zástupce znovu potvrdit souhlas právě pro toho konkrétního člověka.
 *
 * Server volá tuhle funkci vždy znovu — UI jen zobrazí, co by server
 * odmítl, nikdy ne jediná pojistka.
 */
export type ChildCreationRule =
  | { allowed: true; needsParentalConsent: boolean }
  | { allowed: false; reason: "self-managed-under-15" };

export function childCreationRule(
  accountType: AccountType | null | undefined,
  birthDate: string,
  now: Date = new Date(),
): ChildCreationRule {
  const minor = needsParentalConsent(birthDate, now);

  if (accountType === "self" && minor) {
    return { allowed: false, reason: "self-managed-under-15" };
  }

  return { allowed: true, needsParentalConsent: minor };
}

/** Hláška pro uživatele, kterému pravidlo brání. */
export const SELF_UNDER_15_MESSAGE =
  "Účet spravuješ sám, takže můžeš zakládat jen profily od 15 let. " +
  "Profil mladšího dítěte musí založit zákonný zástupce z jeho účtu.";
