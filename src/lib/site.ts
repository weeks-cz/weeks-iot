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
 * Správce osobních údajů a provozovatel učebny.
 *
 * Od 28. 9. 2026 Weeks s.r.o. — stejná firma, která pořádá tábory na
 * weeks.cz. Dřív tu stál Lukáš Kubík jako OSVČ (odvozené z karlovarských
 * táborů, nikdy neověřené) a zásady odkazovaly na weeks.cz/gdpr, které
 * o učebně neříká ani slovo. Učebna proto má vlastní zásady a podmínky
 * (`/ochrana-udaju`, `/podminky`) — žijí vedle textů souhlasů a mění se
 * s nimi.
 *
 * Platby tu zatím nejsou. Až přibudou, prodávající musí sedět s tím, kdo
 * peníze opravdu přijímá (Comgate účet s.r.o.) — neměnit jen tenhle text.
 *
 * Změna je úprava téhle konstanty a bump verze souhlasů
 * (viz features/consent/texts.ts).
 */
export const CONTROLLER = {
  name: "Weeks s.r.o.",
  ico: "29984360",
  address: "Arbesovo náměstí 70/4, Smíchov, 150 00 Praha 5",
  court: "Městský soud v Praze, sp. zn. C 455169",
  email: "info@weeks.cz",
  privacyUrl: `${SITE.url}/ochrana-udaju`,
  termsUrl: `${SITE.url}/podminky`,
} as const;
