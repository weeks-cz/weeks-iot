/**
 * Jednoduchý in-memory sliding-window rate limiter.
 * Slouží jako ochrana proti spamu a nekontrolovaným nákladům na /api/chat.
 *
 * Pozn.: Stav je v paměti procesu — na Vercelu (Fluid Compute) drží napříč
 * requesty v rámci instance, ale ne globálně. Pro tábor/beta je to dostačující
 * první linie; tvrdý strop dává navíc maxOutputTokens v samotném volání modelu.
 */

export interface RateLimiterOptions {
  /** Max počet požadavků v okně. */
  limit: number;
  /** Délka okna v ms. */
  windowMs: number;
}

export interface RateResult {
  allowed: boolean;
  /** Za jak dlouho (ms) bude opět povoleno; 0 když allowed. */
  retryAfterMs: number;
}

export function createRateLimiter({ limit, windowMs }: RateLimiterOptions) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string, now: number): RateResult {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

      if (recent.length >= limit) {
        hits.set(key, recent);
        const oldest = recent[0] ?? now;
        const retryAfterMs = Math.max(1, windowMs - (now - oldest));
        return { allowed: false, retryAfterMs };
      }

      recent.push(now);
      hits.set(key, recent);
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}
