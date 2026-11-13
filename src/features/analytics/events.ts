/**
 * Katalog událostí.
 *
 * Nález N4: dnes chybí událost „začal", takže hlavní metrika brány 1 —
 * dokončení z těch, kdo začali — nejde spočítat vůbec. A události posílá
 * jen přihlášený uživatel, zatímco anonymní relace neposílá nic. To je
 * přesně ten jmenovatel, který chybí.
 *
 * Nová pravidla:
 *   1. Anonym měří stejně jako přihlášený, jen pod anonId.
 *   2. Události o penězích se zapisují ze serveru, ne z klienta.
 *   3. Názvy jsou stabilní — mění se jen přidáním nové, nikdy přejmenováním.
 */

export const EVENT = {
  /** První návštěva v relaci. Nese UTM, referrer a vstupní cestu. */
  VISIT_FIRST: "visit_first",

  /** Jmenovatel metriky brány 1. Bez něj nejde spočítat dokončení. */
  LESSON_START: "lesson_start",
  /** Čitatel téže metriky. */
  LESSON_COMPLETE: "lesson_complete",

  /**
   * Spuštění programu v lekci. Nese, jestli prošel, a kolikátý to byl pokus.
   *
   * Tohle je náhrada za „lekci vyzkoušet na reálném dítěti" do doby, než
   * na to dojde: lekce, u které je průměrně deset pokusů, je špatně
   * napsaná, ne těžká. Bez toho se pozná jen to, že ji nikdo nedokončil,
   * ale ne PROČ.
   */
  LESSON_RUN: "lesson_run",
  /** Vyžádaná nápověda. Kde a kolikátá — mapa míst, kde lekce drhne. */
  LESSON_HINT: "lesson_hint",

  COURSE_START: "course_start",
  COURSE_COMPLETE: "course_complete",

  /** Zobrazení zdi po dokončené lekci — kde se ztrácí registrace. */
  SIGNUP_PROMPT_VIEW: "signup_prompt_view",
  /** Definice „registrovaného": dokončený onboarding, ne otevřená stránka. */
  SIGNUP_PARENT: "signup_parent",
  SIGNUP_START: "signup_start",

  /* ── Cesta od `signup_start` k `signup_parent` ─────────────────────────
     Do listopadu 2026 mezi těmi dvěma nebylo nic, takže se nedalo říct,
     jestli lidé odpadají u formuláře, u Googlu, u potvrzovacího e-mailu,
     nebo v onboardingu. Žádná z těchhle událostí nejde do GA4 (whitelist
     `GA_EVENTS` ve `cookies/vendors.ts`).

     Identita: před přihlášením nese řádek jen anon_id, `email_confirmed`
     jen parent_id (zapisuje ho server, který prohlížeč nezná), po
     přihlášení obojí. Jak to spárovat, ukazuje docs/metriky-brana-1.sql. */

  /** Zobrazení `/registrace`. Nese `env` (viz `analytics/environment.ts`). */
  SIGNUP_VIEW: "signup_view",
  /** Odpověď serveru na formulář e-mail + heslo: `result` sent | invalid | error. */
  SIGNUP_EMAIL_SUBMIT: "signup_email_submit",
  /** Klik na tlačítko Googlu (registrace i přihlášení, rozlišuje `page`). */
  AUTH_GOOGLE_CLICK: "auth_google_click",
  /** Google vydal token a Supabase ho přijal — rodič je přihlášený. */
  AUTH_GOOGLE_SUCCESS: "auth_google_success",
  /** Přihlášení Googlem selhalo. `stage` říká kde: token | script | redirect. */
  AUTH_GOOGLE_ERROR: "auth_google_error",
  /** Potvrzovací odkaz z e-mailu. Zapisuje VÝHRADNĚ server v `/auth/confirm`. */
  EMAIL_CONFIRMED: "email_confirmed",
  /** Vstup do kroku onboardingu (`step` 1–3). Jednou za krok a záložku. */
  ONBOARDING_STEP_VIEW: "onboarding_step_view",

  /** Trychtýř na tábor. utm_content nese místo, odkud se kliklo. */
  CAMP_CTA_CLICK: "camp_cta_click",
  /** Podklad pro expanzi 2028. */
  WAITLIST_CITY_JOIN: "waitlist_city_join",

  PROJECT_EXPORT: "project_export",
  CERTIFICATE_ISSUED: "certificate_issued",
  PAYWALL_VIEW: "paywall_view",
  CHECKOUT_START: "checkout_start",
  /** Zapisuje VÝHRADNĚ server z callbacku brány. Klient nikdy. */
  PURCHASE: "purchase",

  CHILD_PROFILE_CREATED: "child_profile_created",
  CHILD_PROFILE_SWITCHED: "child_profile_switched",
  CONSENT_GRANTED: "consent_granted",
  CONSENT_REVOKED: "consent_revoked",
  ACCOUNT_DELETED: "account_deleted",
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];

/** Události, které klient zapisovat nesmí — rozhodují o penězích. */
export const SERVER_ONLY_EVENTS: readonly EventName[] = [
  EVENT.PURCHASE,
  EVENT.CERTIFICATE_ISSUED,
] as const;

export function isServerOnlyEvent(name: string): boolean {
  return (SERVER_ONLY_EVENTS as readonly string[]).includes(name);
}
