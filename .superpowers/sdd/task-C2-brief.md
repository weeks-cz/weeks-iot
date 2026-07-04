### Task C2: Plans lib (ceny, expirace, premium check)

**Files:**
- Create: `src/lib/payments/plans.ts`
- Test: `src/lib/payments/__tests__/plans.test.ts`

**Interfaces:**
- Produces:
  - `PLANS: { monthly: { priceKc: 79; label: "Weeks Premium — měsíční"; days: 31 }, yearly: { priceKc: 699; label: "Weeks Premium — roční"; days: 366 } }`
  - `type PlanPeriod = "monthly" | "yearly"`
  - `isPlanPeriod(v: unknown): v is PlanPeriod`
  - `computeNewExpiry(currentExpiryIso: string | null, period: PlanPeriod, now: Date): string` — prodlužuje od `max(now, currentExpiry)`
  - `hasPremium(plan: string | null | undefined, expiresAtIso: string | null | undefined, now?: Date): boolean`

- [ ] **Step 1: Failing test**

```typescript
// src/lib/payments/__tests__/plans.test.ts
import { describe, it, expect } from "vitest";
import { PLANS, isPlanPeriod, computeNewExpiry, hasPremium } from "@/lib/payments/plans";

const NOW = new Date("2026-07-04T10:00:00Z");

describe("PLANS", () => {
  it("drží schválené ceny", () => {
    expect(PLANS.monthly.priceKc).toBe(79);
    expect(PLANS.yearly.priceKc).toBe(699);
  });
});

describe("isPlanPeriod", () => {
  it("propustí jen monthly/yearly", () => {
    expect(isPlanPeriod("monthly")).toBe(true);
    expect(isPlanPeriod("yearly")).toBe(true);
    expect(isPlanPeriod("weekly")).toBe(false);
    expect(isPlanPeriod(null)).toBe(false);
  });
});

describe("computeNewExpiry", () => {
  it("bez existující expirace počítá od teď", () => {
    expect(computeNewExpiry(null, "monthly", NOW)).toBe("2026-08-04T10:00:00.000Z");
  });
  it("aktivní předplatné prodlužuje od jeho konce", () => {
    expect(computeNewExpiry("2026-07-20T00:00:00.000Z", "yearly", NOW))
      .toBe("2027-07-21T00:00:00.000Z");
  });
  it("prošlé předplatné počítá od teď", () => {
    expect(computeNewExpiry("2026-01-01T00:00:00.000Z", "monthly", NOW))
      .toBe("2026-08-04T10:00:00.000Z");
  });
});

describe("hasPremium", () => {
  it("student s budoucí expirací = premium", () => {
    expect(hasPremium("student", "2026-12-01T00:00:00Z", NOW)).toBe(true);
  });
  it("student s prošlou expirací = ne", () => {
    expect(hasPremium("student", "2026-01-01T00:00:00Z", NOW)).toBe(false);
  });
  it("student bez expirace = premium (neomezené, např. ručně nastavené)", () => {
    expect(hasPremium("student", null, NOW)).toBe(true);
  });
  it("free / undefined = ne", () => {
    expect(hasPremium("free", null, NOW)).toBe(false);
    expect(hasPremium(undefined, undefined, NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `npm test -- plans` → FAIL

- [ ] **Step 3: Implementace**

```typescript
// src/lib/payments/plans.ts
// Jediný zdroj pravdy pro ceny a délky předplatného. Klient částky NIKDY neposílá.
export const PLANS = {
  monthly: { priceKc: 79, label: "Weeks Premium — měsíční", days: 31 },
  yearly: { priceKc: 699, label: "Weeks Premium — roční", days: 366 },
} as const;

export type PlanPeriod = keyof typeof PLANS;

export function isPlanPeriod(v: unknown): v is PlanPeriod {
  return v === "monthly" || v === "yearly";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeNewExpiry(
  currentExpiryIso: string | null,
  period: PlanPeriod,
  now: Date,
): string {
  const current = currentExpiryIso ? Date.parse(currentExpiryIso) : NaN;
  const base = Number.isFinite(current) && current > now.getTime() ? current : now.getTime();
  return new Date(base + PLANS[period].days * DAY_MS).toISOString();
}

export function hasPremium(
  plan: string | null | undefined,
  expiresAtIso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (plan !== "student") return false;
  if (!expiresAtIso) return true;
  const exp = Date.parse(expiresAtIso);
  return Number.isFinite(exp) && exp > now.getTime();
}
```

- [ ] **Step 4: Run** `npm test -- plans` → PASS
- [ ] **Step 5: Commit** `feat(payments): plans lib — pricing, expiry math, premium check`

