import type { Config } from "@/types";

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

// Hardcoded fallback PINs — used when env vars below aren't set.
// These ARE the "default PINs" the admin warning banner checks against.
const FALLBACK_DAILY_PIN = "123";
const FALLBACK_LECTURER_PIN = "2468";
const FALLBACK_ADMIN_PASSWORD = "321";

// PINs sourced from env so deploys can rotate them without a code change.
// NEXT_PUBLIC_* values still ship in the JS bundle — this is not a security boundary,
// the win is keeping production PINs out of git history.
function envPin(envValue: string | undefined, fallback: string): string {
  const v = envValue?.trim();
  return v && v.length > 0 ? v : fallback;
}

export const DEFAULT_CONFIG: Config = {
  dailyPin: envPin(process.env.NEXT_PUBLIC_DAILY_PIN, FALLBACK_DAILY_PIN),
  lecturerPin: envPin(process.env.NEXT_PUBLIC_LECTURER_PIN, FALLBACK_LECTURER_PIN),
  adminPassword: envPin(process.env.NEXT_PUBLIC_ADMIN_PASSWORD, FALLBACK_ADMIN_PASSWORD),
  maxStudents: 15,
  helpCodeCost: 15,
  helpWiringCost: 15,
  skipCost: 30,
};

// Exported so the admin warning banner can detect "still on default values".
export const FALLBACK_PINS = {
  dailyPin: FALLBACK_DAILY_PIN,
  lecturerPin: FALLBACK_LECTURER_PIN,
  adminPassword: FALLBACK_ADMIN_PASSWORD,
} as const;

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
