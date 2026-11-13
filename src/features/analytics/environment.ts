/**
 * Hrubý příznak prostředí: běžný prohlížeč, nebo prohlížeč uvnitř aplikace
 * Facebook či Instagram.
 *
 * Kampaň běží na Metě a lidé z ní otevírají učebnu ve vestavěném prohlížeči.
 * Ten se chová jinak (přihlášení Googlem, potvrzovací odkaz otevřený jinde),
 * a bez téhle značky by se to v datech nedalo oddělit.
 *
 * Ukládá se JEN výsledná hodnota. Celý user agent nikam nejde: je to údaj
 * o zařízení navíc a pro rozhodnutí ho nepotřebujeme.
 *
 * Čistá funkce bez závislostí, protože ji volá prohlížeč i server
 * (`/auth/confirm` čte hlavičku požadavku).
 */

export type BrowserEnvironment = "browser" | "facebook" | "instagram";

/* Instagram se kontroluje první: jeho vestavěný prohlížeč na Androidu nese
   v user agentu i značky Facebooku. */
const INSTAGRAM = /\bInstagram\b/i;
/* FBAN/FBAV (iOS i Android), FB_IAB (Android), FBIOS, Messenger (FBAN/Messenger…).
   Všechno je to Meta a pro tohle měření je to jedno prostředí. */
const FACEBOOK = /FBAN|FBAV|FB_IAB|FBIOS|\[FB/;

export function browserEnvironment(userAgent: string | null | undefined): BrowserEnvironment {
  if (!userAgent) return "browser";
  if (INSTAGRAM.test(userAgent)) return "instagram";
  if (FACEBOOK.test(userAgent)) return "facebook";
  return "browser";
}

/** Prostředí aktuálního prohlížeče. Mimo prohlížeč vrací „browser“. */
export function currentEnvironment(): BrowserEnvironment {
  if (typeof navigator === "undefined") return "browser";
  return browserEnvironment(navigator.userAgent);
}
