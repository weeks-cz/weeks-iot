import { CAMP_CITIES } from "@/lib/camp-offer";
import { cn } from "@/lib/cn";
import { MonoLabel } from "@/components/ui/Surface";
import { CampLink } from "@/features/onboarding/components/CampLink";
import type { CampOffer } from "../offer";

/**
 * Karta letního tábora — jediný zdroj textu pro lobby (`tile`),
 * finále kurzu a /ucet (`card`).
 *
 * Schválně bez data a ceny; termíny a ceny ukazuje jen web táborů.
 */
export function CampCard({
  offer,
  placement,
  size = "card",
}: {
  offer: NonNullable<CampOffer>;
  placement: "lobby" | "finale" | "finale-anonym" | "ucet";
  size?: "tile" | "card";
}) {
  const where = offer.city ? CAMP_CITIES[offer.city].locative : "v Praze a Karlových Varech";
  const sentence =
    offer.kind === "soon"
      ? `Příměstský tábor ${where} — skutečné Arduino a 3D tisk, termíny připravujeme.`
      : `Příměstský tábor ${where} — skutečné Arduino a 3D tisk.`;
  const tile = size === "tile";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-md border border-ink bg-ink text-paper",
        tile ? "p-5" : "p-6 sm:p-8",
      )}
    >
      {/* Dekorace v rohu, proto prázdné alt. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/weeks-w.png"
        alt=""
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-3 right-3 h-auto opacity-25",
          tile ? "w-14" : "w-24",
        )}
      />
      <div className="relative">
        <MonoLabel className="mb-3 text-cta-300">Léto 2027</MonoLabel>
        <h2
          className={cn("mb-3 text-paper", tile ? "font-display text-lg font-semibold" : "heading-3")}
        >
          Tohle všechno naživo
        </h2>
        <p className="mb-4 max-w-prose leading-relaxed text-paper/70">{sentence}</p>
        <CampLink placement={placement} city={offer.city} variant="link" />
      </div>
    </section>
  );
}
