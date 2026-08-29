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

  COURSE_START: "course_start",
  COURSE_COMPLETE: "course_complete",

  /** Zobrazení zdi po dokončené lekci — kde se ztrácí registrace. */
  SIGNUP_PROMPT_VIEW: "signup_prompt_view",
  /** Definice „registrovaného": dokončený onboarding, ne otevřená stránka. */
  SIGNUP_PARENT: "signup_parent",
  SIGNUP_START: "signup_start",

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
