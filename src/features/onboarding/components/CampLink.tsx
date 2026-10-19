"use client";

import { EVENT, track } from "@/features/analytics/track";
import { CAMP_CITIES, campUrl, type CampCity } from "@/lib/camp-offer";

/**
 * Odkaz na registraci tábora.
 *
 * Každý odkaz z aplikace nese `utm_source=ucebna` a v `utm_content` místo,
 * odkud se kliklo. Bez toho nejde vyhodnotit, které místo v aplikaci
 * prodává — a je to jediná věc, kterou se dá v sezóně reálně ladit.
 *
 * Kliknutí se zároveň měří jako `camp_cta_click`. UTM říká, co dorazilo
 * na web táborů; událost říká, kolik lidí odešlo — a ten rozdíl je
 * informace, kterou samotné UTM nedá.
 *
 * S městem vede rovnou na jeho výpis (/tabory?mesto=…). Kde se ještě
 * nedá přihlásit, slibuje tlačítko jen to, co tam rodič najde: formulář
 * „dejte mi vědět o termínech“.
 */
export function CampLink({ placement, city = null }: { placement: string; city?: CampCity | null }) {
  const href = campUrl(
    city,
    `utm_source=ucebna&utm_medium=app&utm_campaign=leto2027&utm_content=${encodeURIComponent(placement)}`,
  );
  const label =
    city && !CAMP_CITIES[city].prihlasky ? "Dát mi vědět o termínech" : "Podívat se na termíny";

  return (
    <a
      href={href}
      target="_blank"
      /* noopener je povinné u target="_blank": bez něj má cílová stránka
         přes window.opener přístup k naší a může ji přesměrovat. */
      rel="noopener noreferrer"
      onClick={() => {
        void track(EVENT.CAMP_CTA_CLICK, {
          placement,
          destination: city ? `weeks.cz/tabory?mesto=${city}` : "weeks.cz/tabory",
        });
      }}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md
                 border border-ink bg-cta-500 px-6 py-3 font-semibold text-ink
                 shadow-hard-sm transition-all duration-200
                 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-cta-400 hover:shadow-hard
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
    >
      {label}
      <span aria-hidden="true">→</span>
      <span className="sr-only">(otevře se v novém okně)</span>
    </a>
  );
}
