import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSafeNextPath } from "@/features/auth/safe-path";
import { afterSignInPath } from "@/features/auth/post-login";

/**
 * Potvrzení e-mailu odkazem z e-mailu (token_hash).
 *
 * Na rozdíl od `/auth/callback` nepotřebuje PKCE cookie (code_verifier).
 * Ta vzniká v prohlížeči, ve kterém se rodič registroval; odkaz z e-mailu
 * ale často otevře v jiném prohlížeči nebo v jiném okně. Výměna kódu tam
 * selže, přestože Supabase adresu už potvrdil. Token_hash ověří kdekoli.
 *
 * Odkaz vytváří send-email hook (`src/app/api/auth/email/route.ts`).
 */
export const dynamic = "force-dynamic";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "recovery", "magiclink", "invite"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const rawNext = searchParams.get("next");
  const next = isSafeNextPath(rawNext) ? rawNext : "/ucet";

  const type = OTP_TYPES.find((t) => t === rawType);
  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=callback`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.warn("[auth/confirm] Ověření odkazu selhalo:", error.message);
    /* Vypršený odkaz je jasný případ. Ostatní chyby (odkaz už byl použit,
       otevřel ho e-mailový robot) neumíme od úspěšného potvrzení rozlišit,
       proto hláška nezní jako „odkaz je rozbitý". */
    const code = (error as { code?: string }).code;
    const reason = code === "otp_expired" ? "expired" : "potvrzeni";
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=${reason}`);
  }

  /* Obnova hesla má vlastní cíl a onboarding se u ní nekontroluje. */
  if (type === "recovery" || next.startsWith("/obnova-hesla")) {
    return NextResponse.redirect(`${origin}${next.startsWith("/obnova-hesla") ? next : "/obnova-hesla/nove"}`);
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=potvrzeni`);
  }

  const { data: parent } = await supabase
    .from("parents")
    .select("onboarding_completed_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  return NextResponse.redirect(
    `${origin}${afterSignInPath({
      onboardingDone: Boolean(parent?.onboarding_completed_at),
      next,
    })}`,
  );
}
