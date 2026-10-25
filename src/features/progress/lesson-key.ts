/**
 * Klíč lekce v odkazu `?zapsat=kurz/lekce`.
 *
 * Posílá ho obrazovka hotové lekce u rodiče, který ještě nevybral profil
 * dítěte. Po výběru profilu se ta jedna lekce zapíše k němu — jinak by se
 * ztratila a dítě by ji dělalo znovu. Hodnota jde z URL, takže se pouští
 * jen tvar `slug/slug`; co lekce opravdu je, ověří až server přes slugy.
 */
const LESSON_KEY = /^[a-z0-9-]{1,40}\/[a-z0-9-]{1,60}$/;

export function parseLessonKey(value: unknown): string | null {
  return typeof value === "string" && LESSON_KEY.test(value) ? value : null;
}
