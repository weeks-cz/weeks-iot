"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Která varianta hlavičky patří k aktuální stránce veřejné zóny.
 *
 * Kurz a lekce jsou už aplikace (tmavá hlavička), úvodní a právní
 * stránky zůstávají světlé. Rozhoduje se na klientovi ze stejného důvodu
 * jako v `HeaderCta`: layout se při přechodu z `/` na `/kurz/iot`
 * nevykresluje znovu, takže serverová volba podle cesty by zůstala stará.
 * Obě varianty jsou hotové ze serveru (session znají), tady se jen vybírá.
 */
export function HeaderByPath({ app, site }: { app: ReactNode; site: ReactNode }) {
  const pathname = usePathname() ?? "";
  return <>{/^\/kurz(\/|$)/.test(pathname) ? app : site}</>;
}
