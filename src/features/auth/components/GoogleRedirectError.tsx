"use client";

import { useEffect } from "react";
import { EVENT } from "@/features/analytics/track";
import { trackGoogle } from "./GoogleSignIn";

/**
 * Chyba Googlu, která dorazila přesměrováním (`/prihlaseni?chyba=google`).
 *
 * Posílá ji přesměrovací tok i dokončení přihlášení přes GIS, když server
 * session nenajde. Prohlížeč o ní jinak neví — dozví se ji až z adresy.
 */
export function GoogleRedirectError() {
  useEffect(() => {
    trackGoogle(EVENT.AUTH_GOOGLE_ERROR, "prihlaseni", { stage: "redirect" });
  }, []);

  return null;
}
