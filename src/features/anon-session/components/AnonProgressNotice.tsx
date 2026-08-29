"use client";

import { Alert } from "@/components/ui/Surface";
import { useAnonCompletedCount } from "../useAnonSession";

/**
 * Ujištění, že rozdělaná práce nepřijde vniveč.
 *
 * Zeď přichází až po dokončené lekci, takže dítě v tu chvíli něco má —
 * a nejčastější důvod, proč registraci nedokončí, je obava, že o to přijde.
 * Tahle hláška na ni odpovídá dřív, než ji někdo vysloví.
 */
export function AnonProgressNotice() {
  const completed = useAnonCompletedCount();

  if (completed === 0) return null;

  return (
    <Alert tone="success" title="Vaše práce je uložená">
      {completed === 1
        ? "Lekci, kterou dítě právě dokončilo, přeneseme do jeho profilu."
        : `Lekce, které dítě dokončilo (${completed}), přeneseme do jeho profilu.`}{" "}
      Nic se neztratí.
    </Alert>
  );
}
