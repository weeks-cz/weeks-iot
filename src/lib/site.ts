/**
 * Jediné místo, kde žijí identitní údaje projektu.
 *
 * Adresa se bere z prostředí, aby preview nasazení generovala vlastní
 * kanonické odkazy místo produkčních — jinak by Google indexoval preview.
 */

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "https://ucebna.weeks.cz";
}

export const SITE = {
  name: "Weeks Učebna",
  tagline: "Postav si vlastní techniku",
  description:
    "Online učebna pro děti 10–15 let. Elektronika, 3D modelování a programování — " +
    "první lekci si zkusíš hned, bez registrace.",
  url: resolveSiteUrl(),
  supportEmail: "info@weeks.cz",
} as const;

/**
 * Správce osobních údajů.
 *
 * POZOR — tohle je jediný právní údaj v projektu, který je odvozený, ne ověřený.
 * Existující zásady Weeks mají dva správce: DDM Praha 6 pro pražské tábory
 * a Lukáše Kubíka (IČO 24878511) pro Karlovy Vary. Učebna je celostátní produkt
 * s vlastní pokladnou, což podle auditu (M8) znamená druhou entitu.
 *
 * Ověřit před spuštěním registrace. Změna je úprava téhle konstanty
 * a bump verze souhlasu (viz features/consent/texts.ts).
 */
export const CONTROLLER = {
  name: "Lukáš Kubík",
  ico: "24878511",
  email: "info@weeks.cz",
  privacyUrl: "https://weeks.cz/karlovy-vary/gdpr",
  termsUrl: "https://weeks.cz/podminky",
} as const;
