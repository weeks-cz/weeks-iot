"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { readAnonSession } from "@/features/anon-session/storage";
import type { OutlineLesson } from "../queries";

interface Props {
  courseSlug: string;
  lessons: OutlineLesson[];
  /** Co má hotové přihlášený profil. U anonyma prázdné. */
  serverCompleted: string[];
}

/**
 * Osnova kurzu s postupem.
 *
 * ── Proč je to na klientovi ────────────────────────────────────────────────
 * Postup má dva zdroje a každý zná jen půlku. Server ví, co je uložené
 * v účtu; prohlížeč ví, co dítě prošlo bez registrace — a to je většina
 * případů, protože první lekce se hraje bez účtu. Kdyby se kreslil jen
 * serverový postup, anonymní dítě by po dokončení lekce vidělo prázdný
 * seznam a nepoznalo, že něco udělalo.
 *
 * Proto se kreslí nejdřív bez postupu (to vidí i vyhledávač) a hned po
 * připojení se doplní z prohlížeče.
 */
export function CourseOutlineList({ courseSlug, lessons, serverCompleted }: Props) {
  const [done, setDone] = useState<Set<string>>(new Set(serverCompleted));

  useEffect(() => {
    const session = readAnonSession();
    if (!session) return;

    const local = session.lessons
      .filter((l) => l.courseSlug === courseSlug && l.completedAt)
      .map((l) => l.lessonSlug);

    if (local.length === 0) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- jednorázové
       přečtení localStorage po připojení. Dřív než tady to nejde: na serveru
       žádný localStorage není a naplnit tím počáteční stav by rozešlo
       hydrataci. */
    setDone(new Set([...serverCompleted, ...local]));
  }, [courseSlug, serverCompleted]);

  const published = lessons.filter((l) => l.isPublished);
  const completed = published.filter((l) => done.has(l.slug)).length;
  /* Kde pokračovat: první nehotová. Ne „další po poslední hotové" — kdo
     přeskočil, má se vrátit k té, kterou vynechal. */
  const next = published.find((l) => !done.has(l.slug));

  return (
    <>
      {completed > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-md border border-ink/15 bg-paper-soft p-4">
          <div className="min-w-0 flex-1">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-500">
              Hotovo {completed} ze {published.length}
            </p>

            <div
              role="progressbar"
              aria-valuenow={completed}
              aria-valuemin={0}
              aria-valuemax={published.length}
              aria-label={`Hotovo ${completed} ze ${published.length} lekcí`}
              className="flex gap-1"
            >
              {published.map((lesson) => (
                <span
                  key={lesson.id}
                  className={`h-1.5 flex-1 rounded-full ${
                    done.has(lesson.slug) ? "bg-trust-500" : "bg-ink/15"
                  }`}
                />
              ))}
            </div>
          </div>

          {next ? (
            <ButtonLink href={`/kurz/${courseSlug}/${next.slug}`}>
              Pokračovat lekcí {next.orderIndex}
            </ButtonLink>
          ) : (
            <p className="font-mono text-xs text-trust-700">celý kurz hotový 🎉</p>
          )}
        </div>
      )}

      {/* Celý řádek je odkaz, ne jen tlačítko vpravo — cíl kliknutí má
          odpovídat tomu, co vypadá klikatelně. */}
      <ol className="flex flex-col gap-3">
        {lessons.map((lesson) => {
          const isDone = done.has(lesson.slug);

          const body = (
            <>
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-sm border font-mono text-sm ${
                  isDone ? "border-trust-600 bg-trust-50 text-trust-700" : "border-ink/20"
                }`}
              >
                {isDone ? <Check className="h-5 w-5" aria-hidden="true" /> : lesson.orderIndex}
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="font-display font-semibold text-ink">
                  {lesson.title}
                  {isDone && <span className="sr-only"> — hotovo</span>}
                </h3>
                {lesson.summary && (
                  <p className="text-sm leading-relaxed text-ink-500">{lesson.summary}</p>
                )}
              </div>

              {lesson.estimatedMinutes && (
                <span className="font-mono text-xs text-ink-300">
                  {lesson.estimatedMinutes} min
                </span>
              )}

              <span
                className={
                  lesson.isPublished
                    ? "rounded-md border border-ink px-4 py-2 text-sm font-semibold text-ink"
                    : "font-mono text-xs text-ink-300"
                }
              >
                {lesson.isPublished ? (isDone ? "Znovu" : "Otevřít") : "připravujeme"}
              </span>
            </>
          );

          return (
            <li key={lesson.id}>
              {lesson.isPublished ? (
                <Link
                  href={`/kurz/${courseSlug}/${lesson.slug}`}
                  className="card-maker card-maker-hover flex flex-wrap items-center gap-4 p-4
                             focus-visible:outline-2 focus-visible:outline-offset-2
                             focus-visible:outline-ink"
                >
                  {body}
                </Link>
              ) : (
                <div className="card-maker flex flex-wrap items-center gap-4 p-4 opacity-60">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
