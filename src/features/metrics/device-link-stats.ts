/**
 * Metriky „Odkaz na počítač" (/pro-rodice).
 *
 * Čísla se berou ze SLOUPCŮ tabulky `device_link_requests`, ne z počtu událostí
 * `device_link_open`: událost se zapisuje při každém otevření odkazu, sloupec
 * jen při prvním, takže jen sloupec říká, kolik LIDÍ to udělalo.
 *
 * Čistá funkce bez přístupu k databázi, aby šla testovat a aby ji
 * `queries.ts` (`server-only`) nemusel kvůli testu importovat.
 */

/** `utm_term` odkazu v e-mailu a v připomínce (features/device-link/link.ts). */
export const DEVICE_LINK_UTM_TERMS = ["odkaz-na-pc", "pripominka-na-pc"] as const;

export interface DeviceLinkRequestRow {
  opened_at: string | null;
  verified_at: string | null;
}

export interface DeviceLinkParentRow {
  utm_term: string | null;
  onboarding_completed_at: string | null;
}

export interface DeviceLinkStats {
  /** Žádosti o odkaz (řádky v období). */
  requested: number;
  /** První otevření odkazu na počítači (`opened_at`). */
  openedOnComputer: number;
  /** První otevření na jakémkoli zařízení (`verified_at`) = schránka je jeho. */
  verified: number;
  /** Dokončené registrace, které přišly z odkazu nebo z připomínky. */
  registrations: number;
}

export function summarizeDeviceLink(
  requests: readonly DeviceLinkRequestRow[],
  parents: readonly DeviceLinkParentRow[],
): DeviceLinkStats {
  const terms: readonly string[] = DEVICE_LINK_UTM_TERMS;
  return {
    requested: requests.length,
    openedOnComputer: requests.filter((r) => r.opened_at).length,
    verified: requests.filter((r) => r.verified_at).length,
    registrations: parents.filter(
      (p) => p.onboarding_completed_at && p.utm_term && terms.includes(p.utm_term),
    ).length,
  };
}
