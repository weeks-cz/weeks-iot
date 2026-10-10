"use client";

import { pixelAllowedFor } from "./consent";

/**
 * GA4 a Meta Pixel — načítání a odesílání.
 *
 * Nic se nenačte, dokud člověk nepřijal příslušnou kategorii
 * (`VendorScripts` volá `ensureGtag`/`ensureFbq` jen po souhlasu).
 * `mirrorToVendors` je jen no-op, pokud skript není načtený — volá se
 * z `track()` vždy, bez ohledu na souhlas.
 */

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & {
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  callMethod?: (...args: unknown[]) => void;
  push?: unknown;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

/** Události, které jdou do GA4 (název → název v GA). Pixel tu nemá nic:
 *  lekce leží na stránkách, kam pixel nesmí (viz `pixelAllowedFor`). */
const GA_EVENTS: Record<string, string> = {
  lesson_start: "lesson_start",
  lesson_complete: "lesson_complete",
  course_start: "course_start",
  course_complete: "course_complete",
};

/** Whitelist parametrů. Všechno ostatní (id, jména) do GA nejde. */
const GA_PARAMS = ["course", "lesson", "order", "hints", "lessons", "anonymous"] as const;

/* Stub gtag jako v oficiálním snippetu: fronta do dataLayer, takže volání
   před načtením gtag.js nic neztratí. */
export function ensureGtag(gaId: string): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // gtag.js čte `arguments` objektu, ne pole — proto přesně tohle.
      // eslint-disable-next-line prefer-rest-params
      (window.dataLayer as unknown[]).push(arguments);
    } as Gtag;
    window.gtag("js", new Date());
    window.gtag("config", gaId, { send_page_view: false });
  }
}

export function gaPageView(path: string): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_location: window.location.href,
    page_path: path,
  });
}

/* Oficiální základ Meta Pixelu (fronta `callMethod`/`queue`), jen v TS. */
export function ensureFbq(): void {
  if (typeof window === "undefined" || window.fbq) return;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue?.push(args);
  } as Fbq;
  n.queue = [];
  n.loaded = true;
  n.version = "2.0";
  n.push = n;
  window.fbq = n;
  window._fbq = n;
}

let fbqInitialized = false;
export function initFbq(pixelId: string): void {
  if (fbqInitialized || typeof window === "undefined" || typeof window.fbq !== "function") return;
  fbqInitialized = true;
  window.fbq("init", pixelId);
}

export function fbqPageView(pathname: string): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (!pixelAllowedFor(pathname)) return;
  window.fbq("track", "PageView");
}

/** Odešle z prohlížeče události, které mají smysl i pro reklamu.
 *  `eventId` páruje browser událost s tou serverovou (CAPI). */
export function fbqTrack(name: string, params?: Record<string, string | number>, eventId?: string): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (eventId) window.fbq("track", name, params ?? {}, { eventID: eventId });
  else window.fbq("track", name, params ?? {});
}

/** Voláno z `track()` pro každou událost. Mimo GA4 nic nedělá. */
export function mirrorToVendors(name: string, props: Record<string, string | number | boolean>): void {
  const gaName = GA_EVENTS[name];
  if (!gaName || typeof window === "undefined" || typeof window.gtag !== "function") return;
  const params: Record<string, string | number | boolean> = {};
  for (const key of GA_PARAMS) {
    const v = props[key];
    if (v !== undefined) params[key] = v;
  }
  window.gtag("event", gaName, params);
}
