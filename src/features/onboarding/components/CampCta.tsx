import type { ComponentProps } from "react";
import type { AudienceSegment } from "@/lib/regions";
import { MonoLabel } from "@/components/ui/Surface";
import { CampCard } from "@/features/camp/components/CampCard";
import type { CampOffer } from "@/features/camp/offer";
import { CityWaitlistForm } from "./CityWaitlistForm";

/**
 * Trychtýř na tábor.
 *
 * Jediné místo v celé aplikaci, kde se z uživatele stává zákazník.
 * Kraj rozhoduje, co člověk uvidí: ve spádu kartu letního termínu,
 * ve zbytku republiky čekačku na město.
 *
 * Čekačka není útěcha. Je to druhý výstup celého projektu — na jaře 2027
 * z ní vznikne seznam měst seřazený podle skutečné poptávky, tedy podklad
 * pro expanzi 2028, který se nedá koupit ani odhadnout.
 */
export function CampCta({
  segment,
  offer,
  placement,
}: {
  segment: AudienceSegment;
  /**
   * Nabídka z `campOfferFor` (stejná jako v lobby a ve finále). Ve spádu
   * bez otevřeného tábora `null` — pak se neukáže nic, ani čekačka.
   */
  offer: CampOffer;
  /** Kam se propíše do utm_content — bez toho nejde vyhodnotit, co prodává. */
  placement: ComponentProps<typeof CampCard>["placement"];
}) {
  if (segment === "camp") {
    return offer ? <CampCard offer={offer} placement={placement} size="card" /> : null;
  }

  return (
    <section className="rounded-md border border-ink/15 bg-paper-soft p-6 sm:p-8">
      <MonoLabel className="mb-3">Tábory</MonoLabel>

      <h2 className="heading-3 mb-3">Zatím jezdíme jen v Praze a Karlových Varech</h2>

      <p className="mb-5 max-w-prose leading-relaxed text-ink-500">
        Do vašeho kraje se s táborem zatím nedostaneme. Napište nám ale své město —
        podle toho, kde je zájem, se rozhodujeme, kam expandovat.
      </p>

      <CityWaitlistForm />
    </section>
  );
}
