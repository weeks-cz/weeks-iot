"use client";

import { useEffect } from "react";
import { readCookieConsent } from "./store";
import { ensureFbq, ensureGtag, fbqTrack, initFbq } from "./vendors";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? "";
const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim() ?? "";

/**
 * Dokončená registrace v prohlížeči (GA4 `sign_up`, Pixel `CompleteRegistration`).
 *
 * Běží na `/ucet?vitejte=1`, tedy až po přesměrování z onboardingu. Jde se
 * sám od sebe, nezávisle na `VendorScripts`: ten se po mountu může objevit
 * o chvíli později a volání by se ztratilo. `eventId` je id uživatele — stejné
 * jako u serverové události CAPI, takže Meta registraci nezapočítá dvakrát.
 *
 * Jednou za záložku: obnovení stránky s `?vitejte=1` konverzi neposílá znovu.
 */
export function RegistrationPixel({ userId }: { userId: string }) {
  useEffect(() => {
    const key = `ucebna-reg-tracked:${userId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* Bez sessionStorage se konverze pošle, nejhůř dvakrát. */
    }

    const consent = readCookieConsent();
    if (consent?.analytics && GA_ID) {
      ensureGtag(GA_ID);
      window.gtag?.("event", "sign_up", { method: "email" });
    }
    if (consent?.marketing && PIXEL_ID) {
      ensureFbq();
      initFbq(PIXEL_ID);
      fbqTrack("CompleteRegistration", { content_name: "ucebna-registrace" }, userId);
    }
  }, [userId]);

  return null;
}
