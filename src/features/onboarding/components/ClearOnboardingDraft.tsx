"use client";

import { useEffect } from "react";
import { clearDraft } from "../draft";

/**
 * Smaže rozpracovaný onboarding po úspěšném dokončení.
 *
 * Běží jen na `/ucet?vitejte=1`, tedy až poté, co server účet skutečně
 * založil. Dřív by smazání nechalo rodiče bez vyplněných údajů, kdyby
 * odeslání selhalo.
 */
export function ClearOnboardingDraft() {
  useEffect(() => {
    clearDraft();
  }, []);
  return null;
}
