"use client";

import { useEffect } from "react";
import { currentEnvironment } from "@/features/analytics/environment";
import { markDeviceLinkOpened } from "../link-actions";

/**
 * Zachycení otevření odkazu z e-mailu (`?odkaz=<token>`).
 *
 * Token se z adresy odstraní hned, ještě před voláním serveru: nemá zůstat
 * v adresním řádku, v odkazující stránce ani v pozdějším měření. Druhé
 * spuštění efektu (StrictMode) už token v adrese nenajde, takže server
 * dostane jedno volání na načtení stránky.
 *
 * Zařízení: dotykový hlavní ukazatel (`pointer: coarse`) = telefon či tablet.
 * Jen otevření na počítači zruší připomínku. Klientský `track()` se nevolá:
 * událost zapisuje server bez `anon_id`.
 */
export function DeviceLinkOpenCapture() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("odkaz");
    if (!token) return;

    url.searchParams.delete("odkaz");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);

    const touch =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    /* Výsledek rodiči nic neukazuje; chyba sítě nesmí rozbít lekci. */
    void markDeviceLinkOpened(token, touch ? "phone" : "computer", currentEnvironment()).catch(
      () => {},
    );
  }, []);

  return null;
}
