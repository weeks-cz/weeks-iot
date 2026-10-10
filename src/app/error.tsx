"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { MonoLabel } from "@/components/ui/Surface";

/**
 * Chyba v běžné stránce. Layout (hlavička, patička) zůstává, takže dítě
 * i rodič mají cestu zpátky. Detail jde jen do konzole — uživateli se neukazuje.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="section-container flex min-h-[60dvh] flex-col items-start justify-center gap-6 py-16">
      <MonoLabel>Něco se nepovedlo</MonoLabel>
      <h1 className="heading-2 max-w-xl">Stránka teď nejde načíst</h1>
      <p className="max-w-lg text-ink-500">
        Nic se neztratilo: rozdělaná lekce zůstává uložená v prohlížeči. Zkuste to znovu,
        a když to nepůjde, vraťte se na lekce.
        {error.digest && (
          <>
            {" "}
            <span className="font-mono text-xs">Kód chyby: {error.digest}</span>
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => unstable_retry()}>
          Zkusit znovu
        </Button>
        <ButtonLink href="/kurz/iot/" variant="outline">
          Na lekce
        </ButtonLink>
      </div>
    </main>
  );
}
