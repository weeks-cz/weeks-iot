"use client";

import { useEffect } from "react";
import { captureAttribution, isTokenPath } from "@/features/anon-session/storage";
import { EVENT, trackOnce } from "../track";
import { currentEnvironment } from "../environment";

/**
 * Zachycení zdroje návštěvy.
 *
 * UTM se ukládají při PRVNÍ návštěvě a už se nepřepisují. Kdyby se
 * přepisovaly při každém příchodu, přepsal by poslední zdroj ten první
 * a atribuce by měřila, odkud se člověk vrátil, ne odkud přišel.
 *
 * Běží v layoutu, ne jen na vstupní stránce — reklama míří i rovnou
 * na lekci.
 */
export function AttributionCapture() {
  useEffect(() => {
    /* Stránka s tokenem v adrese se nezachycuje ani nepočítá jako návštěva. */
    if (isTokenPath(window.location.pathname)) return;
    const session = captureAttribution(new URL(window.location.href), document.referrer);

    /* trackOnce podle anonId: v StrictMode se efekty spouští dvakrát
       a bez toho by každá první návštěva byla v datech dvakrát. */
    void trackOnce(EVENT.VISIT_FIRST, session.anonId, {
      path: window.location.pathname,
      utm_source: session.attribution.utmSource ?? null,
      utm_medium: session.attribution.utmMedium ?? null,
      utm_campaign: session.attribution.utmCampaign ?? null,
      utm_content: session.attribution.utmContent ?? null,
      referrer: session.attribution.referrer ?? null,
      /* Jen ze tří hodnot, nikdy celý user agent. */
      env: currentEnvironment(),
    });
  }, []);

  return null;
}
