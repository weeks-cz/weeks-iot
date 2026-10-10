import { isSafeNextPath } from "./safe-path";

/**
 * Kam po přihlášení.
 *
 * Jediné místo, které to rozhoduje. Sdílí je návrat z e-mailového odkazu
 * (`/auth/callback`) i přihlášení Googlem přímo na stránce, takže se
 * nemůžou rozejít. Kdo ještě neprošel onboardingem, jde do něj — jinak by
 * skončil bez dítěte a bez souhlasu.
 */
export function afterSignInPath(input: {
  onboardingDone: boolean;
  next: unknown;
}): string {
  if (!input.onboardingDone) return "/registrace/onboarding";
  return isSafeNextPath(input.next) ? input.next : "/ucet";
}
