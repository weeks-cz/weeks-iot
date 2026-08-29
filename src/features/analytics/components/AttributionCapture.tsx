"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/features/anon-session/storage";
import { EVENT, trackOnce } from "../track";

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
    });
  }, []);

  return null;
}
