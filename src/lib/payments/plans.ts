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
