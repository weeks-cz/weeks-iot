import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Omezování četnosti.
 *
 * Supabase Auth si vlastní limity na registraci, přihlášení a magic link
 * řeší samo. Tohle je pro akce, které píšeme my: ověření PINu, zápis na
 * čekačku, odeslání onboardingu.
 *
 * Chová se fail-open. Když je databáze nedostupná, požadavek projde —
 * u limitů, které chrání pohodlí a ne peníze, je horší vypnout aplikaci
 * všem než pustit pár pokusů navíc. U plateb by to bylo obráceně.
 */

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  /** Dokončení onboardingu — chrání před robotem zakládajícím účty. */
  onboarding: { limit: 5, windowMs: 60 * 60_000 },
  /** Ověření PINu profilu. Zamykání profilu na to navazuje zvlášť. */
  pinVerify: { limit: 15, windowMs: 15 * 60_000 },
  /** Přidání dítěte. */
  childCreate: { limit: 10, windowMs: 60 * 60_000 },
  /** Zápis na čekačku měst. */
  waitlist: { limit: 3, windowMs: 60 * 60_000 },
  /** Změna souhlasu — brání zaplavení ledgeru. */
  consent: { limit: 20, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Zaznamená pokus a řekne, jestli smí projít.
 *
 * `subject` je to, co se omezuje: IP adresa, id uživatele, id dítěte.
 * Do klíče jde spolu s názvem pravidla, aby se limity navzájem nerušily.
 */
export async function rateLimit(
  name: RateLimitName,
  subject: string,
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[name];
  const bucket = `${name}:${subject}`.slice(0, 200);

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("bump_rate_limit", {
      p_bucket: bucket,
      p_window_ms: rule.windowMs,
    } as never);

    if (error || typeof data !== "number") {
      return { allowed: true, remaining: rule.limit, retryAfterMs: 0 };
    }

    const allowed = data <= rule.limit;
    return {
      allowed,
      remaining: Math.max(0, rule.limit - data),
      /* Přesný zbytek okna neznáme (počítá ho databáze), takže hlásíme
         celé okno. Konzervativní odhad je u Retry-After správně. */
      retryAfterMs: allowed ? 0 : rule.windowMs,
    };
  } catch {
    return { allowed: true, remaining: rule.limit, retryAfterMs: 0 };
  }
}

/**
 * IP adresa volajícího.
 *
 * Na Vercelu je pravdivá jen krajní hodnota z x-forwarded-for, kterou tam
 * zapsal edge. Bereme první položku, ale kdyby hlavička chyběla, vracíme
 * null místo prázdného řetězce — jinak by všichni bez IP sdíleli jeden
 * společný limit.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}
