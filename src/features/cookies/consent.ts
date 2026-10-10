/**
 * Souhlas s cookies pro měřicí nástroje (GA4, Meta Pixel).
 *
 * Tohle NENÍ ledger souhlasů z účtu (`features/consent`, na serveru, append-only).
 * Cookie souhlas žije jen v prohlížeči, v localStorage, a nic z něj se na server
 * neposílá — anonymní relace tak zůstává bez jediného zápisu do naší databáze.
 *
 * Výchozí stav je odmítnuto. Žádná kategorie není předvyplněná (EDPB 03/2022):
 * dokud člověk nerozhodne, nenačte se ani jeden skript třetí strany.
 */

export const COOKIE_CONSENT_KEY = "ucebna-cookie-consent";
/** Změní-li se význam kategorií, zvedni verzi — souhlas se pak ptá znovu. */
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CHANGED_EVENT = "ucebna-cookie-consent-changed";
export const COOKIE_SETTINGS_EVENT = "ucebna-cookie-settings-open";

export interface CookieConsent {
  analytics: boolean;
  marketing: boolean;
  v: number;
  ts: number;
}

export function parseCookieConsent(raw: string | null): CookieConsent | null {
  if (!raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    const o = obj as Record<string, unknown>;
    if (o.v !== COOKIE_CONSENT_VERSION) return null; // starý souhlas → znovu se zeptat
    if (typeof o.analytics !== "boolean" || typeof o.marketing !== "boolean") return null;
    return {
      analytics: o.analytics,
      marketing: o.marketing,
      v: COOKIE_CONSENT_VERSION,
      ts: typeof o.ts === "number" ? o.ts : 0,
    };
  } catch {
    return null; // poškozená hodnota = nerozhodnuto
  }
}

export function serializeCookieConsent(
  choice: { analytics: boolean; marketing: boolean },
  now: number = Date.now(),
): string {
  const value: CookieConsent = {
    analytics: choice.analytics,
    marketing: choice.marketing,
    v: COOKIE_CONSENT_VERSION,
    ts: now,
  };
  return JSON.stringify(value);
}

/**
 * Smí se Meta Pixel na této cestě?
 *
 * Pixel patří na veřejnou část a na rodičovskou zónu (registrace, účet). Na
 * dětské obrazovky nepatří: pixel by sbíral chování dětí pro reklamní cílení,
 * a to rodiče neočekávají. Dětské obrazovky jsou `/ucim-se*` a samotné lekce
 * `/kurz/<kurz>/<lekce>` — ty si dítě otevírá samo bez účtu.
 * Google Analytics běží všude, kde je souhlas (viz CLAUDE/AGENTS).
 */
export function pixelAllowedFor(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/tabor" || path.startsWith("/tabor/")) return false;
  if (path === "/ucim-se" || path.startsWith("/ucim-se/")) return false;
  if (/^\/kurz\/[^/]+\/[^/]+$/.test(path)) return false;
  return true;
}
