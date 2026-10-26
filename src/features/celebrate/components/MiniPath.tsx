import { Fragment } from "react";
import { cn } from "@/lib/cn";
import type { PathLesson } from "@/features/lobby/model";

/**
 * Malá mapa kurzu do oslavy po lekci — kde na cestě dítě je.
 *
 * Zmenšená obdoba `CoursePath` z lobby, jen bez odkazů: hotové lekce
 * zeleně s fajfkou, ta, na kterou se jde dál, amber s číslem, poslední
 * hvězdou (za ní je certifikát). Počet uzlů se bere z publikovaných lekcí.
 * Kreslí se na tmavém pozadí, proto bílé obrysy.
 *
 * Pro čtečku je to jedna věta („4 z 7 lekcí hotovo"), ne sedm čtverečků.
 */
export function MiniPath({ path, nextSlug }: { path: PathLesson[]; nextSlug: string | null }) {
  const done = path.filter((l) => l.done).length;

  return (
    <div className="flex items-center" role="img" aria-label={`${done} z ${path.length} lekcí hotovo`}>
      {path.map((lesson, i) => {
        const isFinal = i === path.length - 1;
        const isNext = lesson.slug === nextSlug;
        return (
          <Fragment key={lesson.slug}>
            {i > 0 && (
              <span aria-hidden="true" className="h-0.5 min-w-1.5 max-w-3.5 flex-1 bg-paper/30" />
            )}
            <i
              aria-hidden="true"
              className={cn(
                "grid size-7 shrink-0 place-items-center border-2 font-display text-xs font-bold not-italic sm:size-[1.875rem]",
                lesson.done && "border-trust-500 bg-trust-500 text-white",
                !lesson.done && isNext && "border-cta-400 bg-cta-400 text-ink",
                !lesson.done && !isNext && "border-paper text-paper",
              )}
            >
              {lesson.done ? "✓" : isFinal ? "★" : i + 1}
            </i>
          </Fragment>
        );
      })}
    </div>
  );
}
