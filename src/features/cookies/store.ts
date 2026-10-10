"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  COOKIE_CHANGED_EVENT,
  COOKIE_CONSENT_KEY,
  COOKIE_SETTINGS_EVENT,
  parseCookieConsent,
  serializeCookieConsent,
  type CookieConsent,
} from "./consent";

/** Čtení a zápis cookie souhlasu v prohlížeči. Jen localStorage, nic na server. */

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    return parseCookieConsent(window.localStorage.getItem(COOKIE_CONSENT_KEY));
  } catch {
    return null; // Safari v soukromém režimu může localStorage zakázat.
  }
}

export function saveCookieConsent(choice: { analytics: boolean; marketing: boolean }): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, serializeCookieConsent(choice));
  } catch {
    /* Bez úložiště se souhlas nezapamatuje — lišta se objeví znovu. */
  }
  window.dispatchEvent(new Event(COOKIE_CHANGED_EVENT));
}

/** Otevře lištu se stávající volbou (odkaz „Nastavení cookies" v patičce). */
export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}

function subscribeCookieConsent(onChange: () => void): () => void {
  window.addEventListener(COOKIE_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COOKIE_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function rawCookieConsent(): string | null {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return null;
  }
}

/**
 * Stav souhlasu pro komponenty. Na serveru a při hydrataci vrací `undefined`
 * („ještě nevíme") — lišta se tak nikdy nevykreslí do HTML a nebliká těm,
 * kdo už rozhodli.
 */
export function useCookieConsent(): CookieConsent | null | undefined {
  const raw = useSyncExternalStore(subscribeCookieConsent, rawCookieConsent, () => undefined);
  return useMemo(() => {
    if (raw === undefined) return undefined;
    return parseCookieConsent(raw);
  }, [raw]);
}
