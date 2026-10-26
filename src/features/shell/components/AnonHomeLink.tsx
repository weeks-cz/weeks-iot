"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { hasCompletedAnyLesson, readAnonSession } from "@/features/anon-session/storage";
import { homeHref } from "../home-href";

/**
 * Logo pro anonyma.
 *
 * Postup bez účtu žije jen v localStorage, takže server vykreslí logo na
 * `/` a po připojení se cíl přepne na přehled kurzu, má-li dítě
 * hotovou aspoň jednu lekci. Vyhledávač i první vykreslení vidí `/`.
 */
export function AnonHomeLink({ initialHref, dark }: { initialHref: string; dark?: boolean }) {
  const [href, setHref] = useState(initialHref);

  useEffect(() => {
    if (!hasCompletedAnyLesson(readAnonSession())) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- jednorázové
       přečtení localStorage po připojení; na serveru žádný není a počáteční
       stav z něj by rozešel hydrataci. */
    setHref(homeHref({ kind: "anon", hasProgress: true }));
  }, []);

  return <Logo href={href} dark={dark} mark />;
}
