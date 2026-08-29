import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSafeNextPath } from "@/features/auth/safe-path";

/**
 * Návrat z OAuth, magic linku, potvrzení adresy a obnovy hesla.
 *
 * Vymění kód za session a pošle člověka tam, kam patří. Rozhodnutí kam
 * není jen `next`: kdo ještě neprošel onboardingem, musí do něj — jinak by
 * skončil v účtu bez kraje, bez dítěte a hlavně bez souhlasu, tedy ve
 * stavu, pro který nemáme právní základ.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next = isSafeNextPath(rawNext) ? rawNext : "/ucet";

  /* Supabase hlásí chybu v parametrech, ne stavovým kódem. Bez tohohle
     větvení by odmítnutý souhlas u Googlu vypadal jako rozbitá aplikace. */
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  if (error) {
    const reason = errorCode === "otp_expired" ? "expired" : "callback";
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=${reason}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=callback`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.warn("[auth/callback] Výměna kódu selhala:", exchangeError.message);
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=callback`);
  }

  /* Obnova hesla má vlastní cíl a onboarding se u ní nekontroluje — kdo si
     mění heslo, už účet dávno má. */
  if (next.startsWith("/obnova-hesla")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=callback`);
  }

  const { data: parent } = await supabase
    .from("parents")
    .select("onboarding_completed_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!parent?.onboarding_completed_at) {
    return NextResponse.redirect(`${origin}/registrace/onboarding`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
