import type { Config } from "@legacy/types";

/**
 * Client-side config. NOT a security boundary.
 * PINs are visible in bundled JS to anyone with devtools.
 * For production admin gating, a backend is required (deferred to v3).
 */

// Bumped to v7: added per-student accounts, mutable config, adminPreviewActive.
export const CONFIG_VERSION = 7;
export const STORAGE_KEY = "iot-camp-screen-state-v7";

export const DAILY_ACCESS_MODE: "manual" | "date-based" = "manual";
export const MAX_STUDENTS_LIMIT = 25;

// TEST_MODE — dev-only override that seeds new accounts with TEST_BALANCE.
// Set NEXT_PUBLIC_TEST_MODE=1 in .env.local. NEVER set in production.
export const TEST_MODE: boolean =
  typeof process !== "undefined" &&
  process.env?.NEXT_PUBLIC_TEST_MODE === "1";

export const TEST_BALANCE = {
  stars: 80,
  styleTokens: 6,
} as const;

// Žádné výchozí PINy. Dřív tu byly fallbacky 123/2468/321, které se dostaly
// do JS bundlu a byly veřejně známé. Bez env proměnné je PIN prázdný a kiosek
// ho odmítá (verifyPin vrací false), takže nezabezpečený režim nevznikne tiše.
// NEXT_PUBLIC_* hodnoty se do bundlu přesto dostanou — je to jen rotace, ne
// bezpečnostní hranice (viz komentář u admin stránky).
function envPin(envValue: string | undefined): string {
  return envValue?.trim() ?? "";
}

export const DEFAULT_CONFIG: Config = {
  dailyPin: envPin(process.env.NEXT_PUBLIC_DAILY_PIN),
  lecturerPin: envPin(process.env.NEXT_PUBLIC_LECTURER_PIN),
  adminPassword: envPin(process.env.NEXT_PUBLIC_ADMIN_PASSWORD),
  maxStudents: 15,
  helpCodeCost: 15,
  helpWiringCost: 15,
  skipCost: 30,
};

/** Který PIN chybí v env. Admin stránka podle toho ukáže, co doplnit. */
export function missingPinNames(config: Config = DEFAULT_CONFIG): string[] {
  return [
    !config.dailyPin && "denní",
    !config.lecturerPin && "lektorský",
    !config.adminPassword && "admin",
  ].filter(Boolean) as string[];
}

export const STYLE_SHOP_CONFIG = {
  directUnlockCost: 40,
  randomSpinStarCost: 15,
  randomSpinTokenCost: 1,
  tokenMilestone: 3,
} as const;

export const AVATAR_SHOP_CONFIG = {
  directUnlockCost: 30,
  randomSpinCost: 12,
} as const;

export const REWARD_CONFIG = {
  noHelpBonusStars: 2,
  firstTryBonusStars: 1,
  dailyChallengeStars: 6,
} as const;

export const SECTION_UNLOCK_COSTS: Record<"advanced" | "expert", number> = {
  advanced: 25,
  expert: 40,
};

export const PREVIEW_ALLOW_ANY_PIN = false;
export const REQUIRE_LECTURER_PIN_FOR_CHECK = false;
