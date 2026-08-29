/**
 * Kdo se kam dostane.
 *
 * Vytaženo z proxy do čisté funkce schválně: chyba v tomhle rozhodování
 * se neprojeví jako pád, ale jako **smyčka přesměrování** — a tu nejde
 * odhalit jinak než tím, že si celý graf přechodů napíšeš do testů.
 *
 * Přesně to se stalo 29. 8.: `/registrace` bylo vedené jako stránka pro
 * nepřihlášené, jenže `/registrace/onboarding` přihlášení VYŽADUJE.
 * Callback poslal rodiče do onboardingu, proxy ho vyhodila na `/ucet`,
 * layout ho poslal zpátky do onboardingu — a tak pořád dokola.
 */

/** Vyžadují přihlášení. */
const PROTECTED_PREFIXES = ["/ucet", "/ucim-se", "/admin"] as const;

/**
 * Nedávají smysl přihlášenému.
 *
 * Zapisuje se sem CELÁ cesta, ne předpona — dokončení onboardingu leží
 * pod `/registrace/` a přihlášení potřebuje.
 */
const GUEST_ONLY_EXACT = ["/prihlaseni", "/registrace", "/obnova-hesla"] as const;

/**
 * Podstromy, které jsou z pravidla pro nepřihlášené vyjmuté.
 *
 * `/registrace/onboarding` dokončuje účet, `/obnova-hesla/nove` nastavuje
 * heslo po kliknutí v e-mailu. Obojí běží na existující session.
 */
const GUEST_ONLY_EXCEPTIONS = ["/registrace/onboarding", "/obnova-hesla/nove"] as const;

/**
 * Sjednocení tvaru cesty.
 *
 * Projekt jede s `trailingSlash: true`, takže sem chodí `/registrace/`.
 * Bez normalizace by porovnání na `/registrace` nikdy nesedlo a pravidlo
 * by tiše nedělalo nic.
 */
export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function underPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function requiresAuth(pathname: string): boolean {
  return underPrefix(normalizePath(pathname), PROTECTED_PREFIXES);
}

export function isGuestOnly(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (underPrefix(path, GUEST_ONLY_EXCEPTIONS)) return false;
  return GUEST_ONLY_EXACT.includes(path as (typeof GUEST_ONLY_EXACT)[number]);
}

export interface AccessDecision {
  action: "allow" | "toLogin" | "toAccount";
}

/** Jediné místo, kde se rozhoduje. Proxy jen provede, co tohle vrátí. */
export function decideAccess(pathname: string, isAuthenticated: boolean): AccessDecision {
  if (!isAuthenticated && requiresAuth(pathname)) return { action: "toLogin" };
  if (isAuthenticated && isGuestOnly(pathname)) return { action: "toAccount" };
  return { action: "allow" };
}
