import type { Config } from "@/types";
import {
  DEFAULT_CONFIG,
  DAILY_ACCESS_MODE,
  PREVIEW_ALLOW_ANY_PIN,
} from "./config";

/**
 * Daily PIN logic. Client-side only — visible in bundled JS.
 * Serves as a soft access gate, not a real security boundary.
 *
 * Ported verbatim from legacy-vanilla/app.js (lines 1692-1709) for parity.
 */

export function getTodayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function buildDailyPin(date: Date = new Date()): string {
  if (PREVIEW_ALLOW_ANY_PIN) {
    return "";
  }

  if (DAILY_ACCESS_MODE === "date-based") {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}${month}`;
  }

  return DEFAULT_CONFIG.dailyPin;
}

export type PinLevel = "daily" | "lecturer" | "admin";

export function verifyPin(input: string, level: PinLevel, config: Config = DEFAULT_CONFIG): boolean {
  if (PREVIEW_ALLOW_ANY_PIN) return true;
  switch (level) {
    case "daily":
      return input === buildDailyPin() || input === config.dailyPin;
    case "lecturer":
      return input === config.lecturerPin;
    case "admin":
      return input === config.adminPassword;
  }
}
