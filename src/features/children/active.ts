/**
 * Který profil se právě učí.
 *
 * Jedno pravidlo pro všechna místa, která to potřebují vědět — přehled
 * `/ucim-se`, stránku lekce i zápis postupu. Dřív ho znal jen přehled;
 * stránka lekce četla samotnou cookie, a protože rodina s jedním dítětem
 * bez PINu cookie nikdy nenastaví, postup se tomu dítěti neměl kam zapsat.
 *
 * Cookie je volba, ne oprávnění: platí jen id z profilů TOHOTO účtu.
 * Jediný profil bez PINu je aktivní i bez volby — vybírat není z čeho.
 * Ve všech ostatních případech se nehádá: zapsat postup cizímu
 * sourozenci je horší než nezapsat ho vůbec.
 */
export function pickActiveChild<T extends { id: string; hasPin: boolean }>(
  children: T[],
  cookieId: string | undefined,
): T | null {
  const chosen = children.find((c) => c.id === cookieId);
  if (chosen) return chosen;

  if (children.length === 1 && !children[0]!.hasPin) return children[0]!;

  return null;
}
