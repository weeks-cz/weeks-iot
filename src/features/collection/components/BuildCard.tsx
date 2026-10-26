import Link from "next/link";
import type { CollectionItem } from "../queries";
import { CircuitThumb } from "./CircuitThumb";

const THUMB_HEIGHT = 176;

/** „26. 10. 2026" — datum uložení výtvoru. */
export function buildDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Europe/Prague",
  });
}

/**
 * Jeden výtvor ve sbírce: náhled obvodu, název lekce a datum.
 * Celá karta je odkaz na detail. Bez uloženého výtvoru je v rohu štítek
 * „vzorové zapojení" (návrh §9.3).
 */
export function BuildCard({ item }: { item: CollectionItem }) {
  return (
    <li className="min-w-0">
      <Link
        href={`/ucim-se/sbirka/${item.slug}`}
        className="card-maker group block h-full rounded-lg p-3 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
      >
        <div className="relative">
          <CircuitThumb
            circuit={item.circuit}
            label={`Obvod z lekce ${item.title}`}
            height={THUMB_HEIGHT}
          />
          {item.reference && (
            <span className="absolute left-2 top-2 rounded-sm bg-paper/90 px-1.5 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-ink-500">
              vzorové zapojení
            </span>
          )}
        </div>
        <h3 className="mt-3 truncate font-semibold">{item.title}</h3>
        <p className="text-sm text-ink-500">
          {item.updatedAt ? buildDate(item.updatedAt) : "hotová lekce"}
        </p>
      </Link>
    </li>
  );
}
