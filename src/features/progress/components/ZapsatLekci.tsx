"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Surface";
import { readAnonSession } from "@/features/anon-session/storage";
import { saveLessonProgressAction } from "../actions";

/**
 * Zápis jedné hotové lekce k právě vybranému profilu.
 *
 * Rodič bez vybraného profilu lekci dokončil, postup zůstal jen
 * v prohlížeči a z hlášky „Postup se zatím neukládá" klikl na „Vybrat
 * profil". Tady se ta jedna lekce — a jen ta, kterou si výslovně chtěl
 * uložit — zapíše k profilu, který vybral. Ostatní postup z prohlížeče se
 * dál přebírá jen po potvrzení v účtu (sourozenci na jednom počítači).
 */
export function ZapsatLekci({ lessonKey }: { lessonKey: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    /* Parametr z adresy pryč hned — obnovení stránky nemá zápis opakovat. */
    window.history.replaceState(null, "", window.location.pathname);

    const [courseSlug, lessonSlug] = lessonKey.split("/");
    const record = readAnonSession()?.lessons.find(
      (l) => l.courseSlug === courseSlug && l.lessonSlug === lessonSlug && l.completedAt,
    );
    if (!record) return;

    void saveLessonProgressAction(record).then((res) => {
      setState(res.ok ? "ok" : "fail");
      /* Přehled pod tím čte postup ze serveru — bez obnovení by dítě
         dál vidělo jako další na řadě lekci, kterou právě zapsalo. */
      if (res.ok) router.refresh();
    });
  }, [lessonKey, router]);

  if (state === "ok") {
    return (
      <Alert tone="success" title="Lekce je zapsaná" className="mb-6 max-w-2xl">
        Hotovou lekci jsme uložili do tohoto profilu.
      </Alert>
    );
  }

  if (state === "fail") {
    return (
      <Alert tone="warning" title="Lekci se nepodařilo zapsat" className="mb-6 max-w-2xl">
        V prohlížeči zůstává. Převzít ji můžete v účtu rodiče.
      </Alert>
    );
  }

  return null;
}
