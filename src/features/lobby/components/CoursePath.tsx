import type { CSSProperties } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { PathLesson } from "../model";

/* Čárkovaná část cesty — svisle na telefonu, vodorovně od `sm`. */
const DASHED =
  "bg-[repeating-linear-gradient(180deg,var(--color-ink-300)_0_8px,transparent_8px_14px)] " +
  "sm:bg-[repeating-linear-gradient(90deg,var(--color-ink-300)_0_8px,transparent_8px_14px)]";

/**
 * Mapa cesty kurzem — čistě prezentační.
 *
 * Každá publikovaná lekce je uzel a odkaz: hotové zeleně s fajfkou
 * (dají se zopakovat), aktuální amber a větší s „právě tady", budoucí bílé
 * s délkou, poslední tmavá s hvězdou „→ certifikát". Nic se nezamyká —
 * pořadí je doporučení, ne zámek. Čára je plná zelená až k aktuálnímu
 * uzlu, dál čárkovaná. Na telefonu svisle.
 */
export function CoursePath({
  course,
  path,
}: {
  course: { slug: string; title: string };
  path: PathLesson[];
}) {
  const current = path.findIndex((l) => !l.done);
  const done = path.filter((l) => l.done).length;

  return (
    <section className="border-b border-ink/10 bg-paper">
      <div className="section-container py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="mono-label">Tvoje cesta kurzem {course.title}</h2>
          <p className="font-mono text-xs text-ink-500">
            {done} / {path.length} hotovo
          </p>
        </div>

        <ol
          className="mt-5 grid sm:mt-6 sm:[grid-template-columns:repeat(var(--nodes),minmax(0,1fr))]"
          style={{ "--nodes": path.length } as CSSProperties}
        >
          {path.map((lesson, i) => {
            const isCurrent = i === current;
            const isFinal = i === path.length - 1;
            /* Úsek k dalšímu uzlu je zelený, dokud nevede za aktuální lekci. */
            const solid = current === -1 || i < current;
            const state = lesson.done ? "done" : isCurrent ? "now" : isFinal ? "final" : "todo";
            const meta =
              state === "done"
                ? "hotovo"
                : state === "now"
                  ? "právě tady"
                  : state === "final"
                    ? "→ certifikát"
                    : lesson.minutes
                      ? `${lesson.minutes} min`
                      : "";

            return (
              <li key={lesson.slug} className="relative">
                {!isFinal && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-[26.5px] top-1/2 h-full w-[3px]",
                      "sm:left-1/2 sm:top-[26.5px] sm:h-[3px] sm:w-full",
                      solid ? "bg-trust-500" : DASHED,
                    )}
                  />
                )}
                <Link
                  href={`/kurz/${course.slug}/${lesson.slug}`}
                  aria-label={`${i + 1}. ${lesson.title} — ${meta || "další lekce"}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className="group relative flex items-center gap-4 rounded-sm py-2 sm:flex-col sm:gap-0 sm:py-0 sm:text-center"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "relative z-10 grid size-14 shrink-0 place-items-center border-2 border-ink font-display text-lg font-bold transition-transform duration-200 sm:mx-auto sm:mb-2.5",
                      state === "done" && "bg-trust-500 text-white",
                      state === "now" && "scale-[1.14] bg-cta-400 text-ink shadow-hard",
                      state === "final" && "bg-ink text-xl text-cta-300",
                      state === "todo" && "bg-white text-ink",
                      "group-hover:-translate-y-0.5",
                    )}
                  >
                    {state === "done" ? "✓" : isFinal ? "★" : i + 1}
                  </span>
                  <span aria-hidden="true" className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight group-hover:underline sm:px-1">
                      {lesson.title}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block font-mono text-xs",
                        state === "now" ? "font-medium text-cta-700" : "text-ink-500",
                      )}
                    >
                      {meta || " "}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
