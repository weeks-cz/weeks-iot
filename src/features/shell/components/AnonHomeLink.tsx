"use client";

import { Logo } from "@/components/ui/Logo";
import { hasCompletedAnyLesson } from "@/features/anon-session/storage";
import { useAnonSession } from "@/features/anon-session/useAnonSession";
import { homeHref } from "../home-href";

/**
 * Logo pro anonyma.
 *
 * Postup bez účtu žije jen v localStorage, takže server vykreslí logo na
 * `/` a po připojení se cíl přepne na přehled kurzu, má-li dítě
 * hotovou aspoň jednu lekci. Vyhledávač i první vykreslení vidí `/`.
 * Relace se odebírá, takže se cíl přepne i hned po dokončení první lekce,
 * bez znovunačtení stránky.
 */
export function AnonHomeLink({ initialHref, dark }: { initialHref: string; dark?: boolean }) {
  const session = useAnonSession();
  const href = hasCompletedAnyLesson(session)
    ? homeHref({ kind: "anon", hasProgress: true })
    : initialHref;

  return <Logo href={href} dark={dark} mark />;
}
