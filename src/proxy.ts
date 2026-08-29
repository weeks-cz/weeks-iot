import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy — běží před vykreslením každé routy.
 *
 * Konvence `middleware.ts` je v Next 16 zavržená a přejmenovaná na `proxy`
 * (viz node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * Chování je stejné, mění se jen název souboru a exportu.
 *
 * Dělá dvě věci: obnovuje session (bez toho se rodič po hodině tiše
 * odhlásí) a odklání nepřihlášené z chráněných zón.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  /* Statická aktiva se přeskakují — nemají session ani co chránit,
     a každý zbytečný průchod stojí čas na každém požadavku. */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
