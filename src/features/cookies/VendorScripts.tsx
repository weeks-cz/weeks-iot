"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { pixelAllowedFor } from "./consent";
import { useCookieConsent } from "./store";
import { ensureFbq, ensureGtag, fbqPageView, gaPageView, initFbq } from "./vendors";

/**
 * Načítá GA4 a Meta Pixel jen po souhlasu. Bez env proměnné se nenačte nic.
 *
 * Změna souhlasu za běhu: skripty nejde spolehlivě vypnout, takže když se
 * odebere souhlas, jehož skripty už běží, stránka se znovu načte — tím
 * odejdou i všechny instance skriptů.
 */

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? "";
const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim() ?? "";

export function VendorScripts() {
  const pathname = usePathname();
  const consent = useCookieConsent();
  const loadedRef = useRef({ analytics: false, marketing: false });

  // Odvolání souhlasu, jehož skripty už běží, vyžaduje reload stránky.
  useEffect(() => {
    if (consent === undefined) return;
    const was = loadedRef.current;
    if ((was.analytics && !consent?.analytics) || (was.marketing && !consent?.marketing)) {
      window.location.reload();
    }
  }, [consent]);

  const gaOn = Boolean(GA_ID && consent?.analytics);
  const pixelOn = Boolean(PIXEL_ID && consent?.marketing);

  // Stuby vznikají až po souhlasu; gtag.js pak dohoní frontu z dataLayer.
  useEffect(() => {
    if (!gaOn) return;
    ensureGtag(GA_ID);
    loadedRef.current.analytics = true;
  }, [gaOn]);

  useEffect(() => {
    if (!pixelOn) return;
    ensureFbq();
    initFbq(PIXEL_ID);
    loadedRef.current.marketing = true;
  }, [pixelOn]);

  // Zobrazení stránky při každé změně cesty (SPA navigace).
  useEffect(() => {
    if (gaOn) gaPageView(pathname);
  }, [gaOn, pathname]);

  useEffect(() => {
    if (pixelOn) fbqPageView(pathname);
  }, [pixelOn, pathname]);

  return (
    <>
      {gaOn && (
        <Script
          id="ga4-loader"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
          strategy="afterInteractive"
        />
      )}
      {pixelOn && pixelAllowedFor(pathname) && (
        <Script
          id="meta-pixel-loader"
          src="https://connect.facebook.net/en_US/fbevents.js"
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
