import { NextResponse } from "next/server";
import { createStatelessClient } from "@/lib/supabase/server";
import { isSafeNextPath } from "@/features/auth/safe-path";

/**
 * Potvrzení registrace odkazem z e-mailu (token_hash).
 *
 * Na rozdíl od `/auth/callback` nepotřebuje PKCE cookie (code_verifier).
 * Ta vzniká v prohlížeči, ve kterém se rodič registroval; odkaz z e-mailu
 * ale často otevře v jiném prohlížeči nebo v jiném okně. Výměna kódu tam
 * selže, přestože Supabase adresu už potvrdil. Token_hash ověří kdekoli.
 *
 * Právě proto tady NIKOHO NEPŘIHLAŠUJEME: odkaz není vázaný na prohlížeč,
 * takže by kdokoli mohl poslat odkaz ke svému účtu cizímu rodiči — ten by
 * se ocitl přihlášený v cizím účtu a vyplnil do něj údaje o svém dítěti
 * (login CSRF). Adresu jen potvrdíme klientem bez cookies — session vznikne
 * jen v paměti požadavku, do prohlížeče se nedostane — a rodič se přihlásí
 * heslem. Obnova hesla, magic link a pozvánka přihlašují, a proto zůstávají
 * na PKCE přes `/auth/callback`.
 *
 * Odkaz vytváří send-email hook (`src/app/api/auth/email/route.ts`).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const rawNext = searchParams.get("next");
  const nextParam = isSafeNextPath(rawNext) ? `&next=${encodeURIComponent(rawNext)}` : "";

  if (!tokenHash || searchParams.get("type") !== "signup") {
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=callback`);
  }

  const supabase = createStatelessClient();
  const { error } = await supabase.auth.verifyOtp({ type: "signup", token_hash: tokenHash });

  if (error) {
    console.warn("[auth/confirm] Ověření odkazu selhalo:", error.message);
    /* Vypršený odkaz je jasný případ. Ostatní chyby (odkaz už byl použit,
       otevřel ho e-mailový robot) neumíme od úspěšného potvrzení rozlišit,
       proto hláška nezní jako „odkaz je rozbitý". */
    const code = (error as { code?: string }).code;
    const reason = code === "otp_expired" ? "expired" : "potvrzeni";
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=${reason}${nextParam}`);
  }

  /* Session z verifyOtp žije jen v paměti; zrušíme ji i na serveru, ať po
     ní nezůstane platný refresh token. `scope: "local"` nechá ostatní
     přihlášení rodiče být. Když to selže, nic se neděje — token nikdo nemá. */
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  return NextResponse.redirect(`${origin}/prihlaseni?potvrzeno=1${nextParam}`);
}
