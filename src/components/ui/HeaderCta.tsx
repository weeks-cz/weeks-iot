"use client";

import { usePathname } from "next/navigation";
import { ButtonLink } from "./Button";

/**
 * „Zkusit zdarma" v hlavičce.
 *
 * V lekci se neukazuje: dítě už ji zkouší a amber tlačítko nahoře by
 * soupeřilo s tím, které ho v lekci vede dál. Amber patří jedné akci
 * na obrazovce.
 */
export function HeaderCta() {
  const pathname = usePathname();
  const inLesson = /^\/kurz\/[^/]+\/[^/]+/.test(pathname ?? "");
  if (inLesson) return null;

  return (
    <ButtonLink href="/kurz/iot" size="sm">
      Zkusit zdarma
    </ButtonLink>
  );
}
