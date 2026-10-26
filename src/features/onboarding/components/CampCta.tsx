import type { ComponentProps } from "react";
import type { AudienceSegment } from "@/lib/regions";
import { CAMP_CITIES, type CampCity } from "@/lib/camp-offer";
import { MonoLabel } from "@/components/ui/Surface";
import { CampCard } from "@/features/camp/components/CampCard";
import { CampLink } from "./CampLink";
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
  city = null,
  placement,
}: {
  segment: AudienceSegment;
  /** Město tábora podle kraje rodiče; null = obecná karta pro oba spády. */
  city?: CampCity | null;
  /** Kam se propíše do utm_content — bez toho nejde vyhodnotit, co prodává. */
  placement: ComponentProps<typeof CampCard>["placement"];
}) {
  if (segment === "camp") {
    const kind = city && !CAMP_CITIES[city].prihlasky ? "soon" : "open";
    return <CampCard offer={{ kind, city }} placement={placement} size="card" />;
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
