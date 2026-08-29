import type { AudienceSegment } from "@/lib/regions";
import { DarkSection, MonoLabel } from "@/components/ui/Surface";
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
  placement,
}: {
  segment: AudienceSegment;
  /** Kam se propíše do utm_content — bez toho nejde vyhodnotit, co prodává. */
  placement: string;
}) {
  if (segment === "camp") {
    return (
      <DarkSection className="rounded-md p-6 sm:p-8">
        <MonoLabel dark className="mb-3">
          Léto 2027
        </MonoLabel>

        <h2 className="heading-3 mb-3 text-paper">
          To, co staví v učebně, si u nás postaví naživo
        </h2>

        <p className="mb-5 max-w-prose leading-relaxed text-paper/70">
          Příměstský tábor chytrých technologií v Praze a Karlových Varech. Skutečné
          Arduino, skutečná 3D tiskárna, lektor u stolu. Roční předplatné{" "}
          <span className="font-mono">699 Kč</span> se z ceny tábora odečítá.
        </p>

        <CampLink placement={placement} />
      </DarkSection>
    );
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
