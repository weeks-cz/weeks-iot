"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/site";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  magicLinkSchema,
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
} from "@/features/onboarding/schema";
import { fieldErrorsFrom, type ActionState } from "@/features/actions";
import { isSafeNextPath } from "./safe-path";

/**
 * Přihlašování a registrace.
 *
 * ── Proč se u chyb nerozlišuje, jestli účet existuje ───────────────────────
 * Registrace i obnova hesla odpovídají stejně bez ohledu na to, jestli je
 * adresa v databázi. Rozdílná odpověď je výčet účtů: kdokoli by si mohl
 * ověřit, jestli konkrétní rodič službu používá. U služby pro děti to není
 * teoretický problém.
 */

function callbackUrl(next: string): string {
  const safe = isSafeNextPath(next) ? next : "/ucet";
  return `${SITE.url}/auth/callback?next=${encodeURIComponent(safe)}`;
}

/* ── Registrace ────────────────────────────────────────────────────────── */

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      /* Po potvrzení adresy pokračuje rodič rovnou v onboardingu — jinak
         by skončil na prázdné stránce a nevěděl, co dál. */
      emailRedirectTo: callbackUrl("/registrace/onboarding"),
    },
  });

  if (error) {
    /* Supabase u existující adresy vrací obecnou chybu schválně. Kdyby
       přesto prošla konkrétní hláška, nepředáváme ji dál. */
    if (/already registered|already exists/i.test(error.message)) {
      return {
        success:
          "Pokud je adresa volná, poslali jsme na ni potvrzovací e-mail. " +
          "Zkontrolujte i složku s nevyžádanou poštou.",
      };
    }
    if (/rate limit|too many/i.test(error.message)) {
      return { error: "Příliš mnoho pokusů. Zkuste to prosím za pár minut." };
    }
    return { error: "Účet se nepodařilo založit. Zkuste to prosím znovu." };
  }

  return {
    success:
      "Poslali jsme vám potvrzovací e-mail. Otevřete odkaz a dokončíte registraci. " +
      "Zkontrolujte i složku s nevyžádanou poštou.",
  };
}

/* ── Přihlášení heslem ─────────────────────────────────────────────────── */

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const next = String(formData.get("next") ?? "/ucet");

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return {
        error:
          "Adresa ještě není potvrzená. Otevřete odkaz z e-mailu, který jsme vám poslali.",
      };
    }
    /* Jedna hláška pro špatné heslo i neexistující účet. Rozlišení by
       prozradilo, které adresy jsou zaregistrované. */
    return { error: "Nesprávný e-mail nebo heslo." };
  }

  redirect(isSafeNextPath(next) ? next : "/ucet");
}

/* ── Magic link ────────────────────────────────────────────────────────── */

export async function magicLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const next = String(formData.get("next") ?? "/ucet");

  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: callbackUrl(next),
      /* Magic link nesmí zakládat účty. Bez tohohle by šlo obejít celý
         onboarding — vznikl by rodič bez kraje, bez dítěte a bez souhlasu. */
      shouldCreateUser: false,
    },
  });

  /* Odpověď je stejná i pro neexistující adresu. */
  return {
    success:
      "Pokud u téhle adresy existuje účet, poslali jsme na ni odkaz pro přihlášení. " +
      "Platí 60 minut.",
  };
}

/* ── Obnova hesla ──────────────────────────────────────────────────────── */

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl("/obnova-hesla/nove"),
  });

  return {
    success:
      "Pokud u téhle adresy existuje účet, poslali jsme na ni odkaz pro nastavení nového hesla.",
  };
}

export async function setNewPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  /* Bez platné session by updateUser tiše neudělal nic. Odkaz na obnovu
     má omezenou platnost a tohle je místo, kde se to projeví. */
  if (!data.user) {
    return {
      error: "Odkaz pro obnovu hesla vypršel. Požádejte prosím o nový.",
    };
  }

  const ip = clientIp(await headers()) ?? data.user.id;
  const limit = await rateLimit("onboarding", ip);
  if (!limit.allowed) {
    return { error: "Příliš mnoho pokusů. Zkuste to prosím za hodinu." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (/should be different/i.test(error.message)) {
      return { fieldErrors: { password: "Nové heslo musí být jiné než to původní." } };
    }
    return { error: "Heslo se nepodařilo změnit. Zkuste to prosím znovu." };
  }

  redirect("/ucet?heslo=zmeneno");
}

/* ── Google ────────────────────────────────────────────────────────────── */

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = String(formData.get("next") ?? "/ucet");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl(next),
      queryParams: {
        /* Vynucený výběr účtu. Bez toho Google tiše přihlásí ten, který má
           zrovna v prohlížeči — a rodič si založí účet pod adresou dítěte. */
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    redirect("/prihlaseni?chyba=google");
  }

  redirect(data.url);
}

/* ── Odhlášení ─────────────────────────────────────────────────────────── */

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
