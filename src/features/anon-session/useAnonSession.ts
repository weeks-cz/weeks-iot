"use client";

import { useMemo, useSyncExternalStore } from "react";
import { ANON_STORAGE_KEY, anonSessionSchema, type AnonSession } from "./schema";

/**
 * Čtení anonymní relace v komponentě.
 *
 * `useSyncExternalStore` místo `useState` + `useEffect`. localStorage je
 * přesně ten „externí zdroj", pro který je tahle funkce určená, a řeší dvě
 * věci, které se ručním efektem dělají špatně:
 *
 *   1. Nespouští kaskádu překreslení. Varianta „vykresli prázdno, pak
 *      v efektu setState" překreslí komponentu dvakrát pokaždé.
 *   2. Má samostatnou hodnotu pro server (`getServerSnapshot`), takže
 *      nevzniká rozdíl mezi serverovým a klientským výstupem a hydratace
 *      nehlásí chybu.
 *
 * Snapshotem je surový řetězec z localStorage, ne rozparsovaný objekt.
 * React porovnává snapshoty přes Object.is — objekt by byl při každém volání
 * nový a React by se zacyklil. Řetězec je stabilní, dokud se obsah nezmění.
 */

/* Relace se během života stránky mění jen našimi vlastními zápisy, po
   kterých stejně následuje překreslení. Odběr proto nic neposlouchá. */
const noopSubscribe = () => () => {};

function readRaw(): string {
  try {
    return window.localStorage.getItem(ANON_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

const EMPTY_ON_SERVER = "";

/** Surový obsah relace. Prázdný řetězec na serveru i při nedostupném úložišti. */
export function useAnonSessionRaw(): string {
  return useSyncExternalStore(noopSubscribe, readRaw, () => EMPTY_ON_SERVER);
}

/** Ověřená relace, nebo null. */
export function useAnonSession(): AnonSession | null {
  const raw = useAnonSessionRaw();

  return useMemo(() => {
    if (!raw) return null;
    try {
      const parsed = anonSessionSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [raw]);
}

/** Počet dokončených lekcí v anonymní relaci. */
export function useAnonCompletedCount(): number {
  const session = useAnonSession();
  return session?.lessons.filter((l) => l.completedAt).length ?? 0;
}
