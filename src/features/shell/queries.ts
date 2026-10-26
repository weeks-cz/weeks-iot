import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/features/account/session";
import { getActiveChild } from "@/features/children/queries";
import { toViewer, type Viewer } from "./home-href";

/**
 * Kdo se dívá — pro hlavičku.
 *
 * `cache()` drží výsledek po jedno vykreslení: layout i stránka pod ním
 * se můžou zeptat oba a profily se načtou jednou. `hasProgress`
 * u anonyma server nezná (je v localStorage), doplní ho `AnonHomeLink`.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await getCurrentUser();
  if (!user) return { kind: "anon" };
  const { active } = await getActiveChild(user.id);
  return toViewer(user, active);
});
