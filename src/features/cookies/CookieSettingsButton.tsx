"use client";

import { openCookieSettings } from "./store";

/** Odkaz v patičce: znovu otevře lištu se stávající volbou (GDPR čl. 7 odst. 3). */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="text-left text-ink-500 underline underline-offset-4 hover:text-ink"
    >
      Nastavení cookies
    </button>
  );
}
