"use client";

import { useEffect } from "react";
import { clearAnonBuilds } from "@/features/collection/anon-builds";
import { clearAnonSession } from "../storage";

/**
 * Po dokončené registraci smaže anonymní postup z tohoto prohlížeče.
 *
 * Postup už je v účtu dítěte (onboarding ho přenesl). Bez smazání by zůstal
 * v localStorage a při dalším onboardingu na sdíleném počítači by se připsal
 * cizímu dítěti. Běží jen na `/ucet?vitejte=1`, tedy až po úspěšném přenosu.
 */
export function ClearAnonSession() {
  useEffect(() => {
    clearAnonSession();
    clearAnonBuilds();
  }, []);
  return null;
}
