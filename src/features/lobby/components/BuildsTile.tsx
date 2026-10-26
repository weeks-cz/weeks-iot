import Link from "next/link";
import { CircuitThumb } from "@/features/collection/components/CircuitThumb";
import type { BuildTile } from "../model";

const THUMB_HEIGHT = 88;

/**
 * „Co jsi postavil" — poslední hotové lekce jako malé náhledy obvodu.
 *
 * Náhledy se kreslí líně (`CircuitThumb` čeká, až je box vidět), takže
 * lobby se kvůli nim při načtení nezadrhne. Volné místo s přerušovaným
 * rámečkem ukazuje, co přibude po další lekci.
 */
export function BuildsTile({
  tiles,
  next,
}: {
  tiles: BuildTile[];
  /** Další lekce na řadě; bez ní (kurz hotový) prázdné místo není. */
  next: { title: string } | null;
}) {
  const showSlot = next !== null && tiles.length < 4;

  return (
    <section className="card-maker flex h-full flex-col p-5">
      <h2 className="mono-label mb-4">Co jsi postavil</h2>

      <ul className="grid flex-1 grid-cols-2 content-start gap-3">
        {tiles.map((tile) => (
          <li key={tile.slug} className="min-w-0">
            <div className="relative">
              <CircuitThumb
                circuit={tile.circuit}
                label={`Obvod z lekce ${tile.title}`}
                height={THUMB_HEIGHT}
              />
              {tile.reference && (
                <span
                  className="absolute left-1.5 top-1.5 rounded-sm bg-paper/90 px-1.5 font-mono text-[0.625rem] uppercase tracking-wider text-ink-500"
                  title="Vzorové zapojení — tvůj výtvor se uloží, až lekci zopakuješ."
                >
                  vzor
                </span>
              )}
            </div>
            <p className="mt-1.5 truncate text-xs font-semibold">{tile.title}</p>
          </li>
        ))}
        {showSlot && (
          <li
            className="grid place-items-center rounded-lg border-[1.5px] border-dashed border-ink/20 px-2 text-center text-xs text-ink-300"
            style={{ height: THUMB_HEIGHT }}
          >
            <span>
              tady bude
              <br />
              <span className="font-semibold text-ink-500">{next.title}</span>
            </span>
          </li>
        )}
      </ul>

      <Link
        href="/ucim-se/sbirka"
        className="mt-4 inline-flex min-h-11 w-fit items-center gap-2 rounded-sm font-semibold text-primary-700 underline-offset-4 hover:underline"
      >
        Celá sbírka <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
