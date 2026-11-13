import { after, NextResponse } from "next/server";
import { createServiceClient, createStatelessClient } from "@/lib/supabase/server";
import { isSafeNextPath } from "@/features/auth/safe-path";
import { EVENT } from "@/features/analytics/events";
import { browserEnvironment } from "@/features/analytics/environment";

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
  const { data, error } = await supabase.auth.verifyOtp({ type: "signup", token_hash: tokenHash });
  const env = browserEnvironment(request.headers.get("user-agent"));

  if (error) {
    console.warn("[auth/confirm] Ověření odkazu selhalo:", error.message);
    /* Vypršený odkaz je jasný případ. Ostatní chyby (odkaz už byl použit,
       otevřel ho e-mailový robot) neumíme od úspěšného potvrzení rozlišit,
       proto hláška nezní jako „odkaz je rozbitý". */
    const code = (error as { code?: string }).code;
    const reason = code === "otp_expired" ? "expired" : "potvrzeni";
    after(() => recordConfirmation(null, { ok: false, reason, env }));
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=${reason}${nextParam}`);
  }

  after(() => recordConfirmation(data.user?.id ?? null, { ok: true, env }));

  /* Session z verifyOtp žije jen v paměti; zrušíme ji i na serveru, ať po
     ní nezůstane platný refresh token. `scope: "local"` nechá ostatní
     přihlášení rodiče být. Když to selže, nic se neděje — token nikdo nemá. */
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  return NextResponse.redirect(`${origin}/prihlaseni?potvrzeno=1${nextParam}`);
}

/**
 * Měření potvrzení (`email_confirmed`).
 *
 * Prohlížeč tu nic nezapíše: odkaz se často otevře jinde, než kde rodič
 * začal, a anon_id odtamtud nemáme. Řádek proto nese jen parent_id — id
 * z ověřeného tokenu, ne z adresy, takže ho nikdo nepodvrhne. Servisní
 * klient, protože bezstavový klient po `signOut` už nemá roli
 * `authenticated` a politika `events_insert_anon` by parent_id odmítla.
 *
 * `env` u potvrzení je prostředí, kde se odkaz OTEVŘEL. Konkrétního
 * člověka s jeho registrací ve Facebooku spárovat nejde (jiný prohlížeč =
 * jiné anon_id). Porovnat jde jen podíly: kolik e-mailů se odeslalo
 * z Facebooku a kolik odkazů se v něm otevřelo.
 *
 * Běží přes `after()`: přesměrování na něj nečeká a chyba ho neshodí.
 */
async function recordConfirmation(
  parentId: string | null,
  props: { ok: boolean; reason?: string; env: string },
): Promise<void> {
  try {
    const { error } = await createServiceClient()
      .from("learning_events")
      .insert({ type: EVENT.EMAIL_CONFIRMED, parent_id: parentId, props });
    if (error) console.warn("[auth/confirm] Zápis měření selhal:", error.message);
  } catch (err) {
    console.warn("[auth/confirm] Zápis měření selhal:", err);
  }
}
