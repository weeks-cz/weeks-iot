"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Surface";
import { readAnonSession } from "../storage";

/**
 * Ujištění, že rozdělaná práce nepřijde vaniveč.
 *
 * Zeď přichází až po dokončené lekci, takže dítě v tu chvíli něco má
 * — a nejčastější důvod, proč registraci nedokončí, je obava, že o to
 * přijde. Tahle hláška na ni odpovídá dřív, než ji někdo vysloví.
 *
 * Vykresluje se až po připojení: relace žije v localStorage, který na
 * serveru neexistuje, a rozdíl mezi serverovým a klientským výstupem by
 * způsobil hydratační chybu.
 */
export function AnonProgressNotice() {
  const [completed, setCompleted] = useState<number | null>(null);

  useEffect(() => {
    const session = readAnonSession();
    setCompleted(session?.lessons.filter((l) => l.completedAt).length ?? 0);
  }, []);

  if (completed === null || completed === 0) return null;

  return (
    <Alert tone="success" title="Vaše práce je uložená">
      {completed === 1
        ? "Lekci, kterou dítě právě dokončilo, přeneseme do jeho profilu."
        : `Lekce, které dítě dokončilo (${completed}), přeneseme do jeho profilu.`}{" "}
      Nic se neztratí.
    </Alert>
  );
}
