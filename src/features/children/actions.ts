"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { EVENT } from "@/features/analytics/events";
import { fieldErrorsFrom, type ActionState } from "@/features/actions";
import { ACTIVE_CHILD_COOKIE } from "./constants";
import { childSchema } from "@/features/onboarding/schema";
import {
  PIN_LOCK_MINUTES,
  clearedLockState,
  hashPin,
  isPinLocked,
  isValidPinFormat,
  isWeakPin,
  nextLockState,
  verifyPin,
} from "./pin";

/**
 * Profily dětí a PIN.
 *
 * Všechno, co se dotýká PINu, běží výhradně tady. Sloupce `pin_hash`,
 * `pin_failed_attempts` a `pin_locked_until` jsou mimo klientský grant,
 * takže se k nim dostane jen servisní klient — a ten žije jen v Server
 * Actions.
 */

async function requireParent() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/prihlaseni");
  return { supabase, userId: data.user.id };
}

/* ── Přidání dítěte ────────────────────────────────────────────────────── */

export async function createChildAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, userId } = await requireParent();

  const limit = await rateLimit("childCreate", userId);
  if (!limit.allowed) {
    return { error: "Příliš mnoho profilů za sebou. Zkuste to prosím za hodinu." };
  }

  const parsed = childSchema.safeParse({
    nick: formData.get("nick"),
    birthDate: formData.get("birthDate"),
    avatar: formData.get("avatar") ?? undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const { data: child, error } = await supabase
    .from("children")
    .insert({
      parent_id: userId,
      nick: parsed.data.nick,
      birth_date: parsed.data.birthDate,
      avatar: parsed.data.avatar ?? "robot",
    })
    .select("id")
    .single();

  if (error || !child) {
    console.error("[children] Založení selhalo:", error?.message);
    return { error: "Profil se nepodařilo založit. Zkuste to prosím znovu." };
  }

  await supabase.from("learning_events").insert({
    type: EVENT.CHILD_PROFILE_CREATED,
    parent_id: userId,
    child_id: child.id,
    props: {},
  });

  revalidatePath("/ucet");
  return { success: `Profil ${parsed.data.nick} je hotový.` };
}

/* ── Úprava dítěte ─────────────────────────────────────────────────────── */

const updateChildSchema = childSchema.extend({ childId: z.string().uuid() });

export async function updateChildAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireParent();

  const parsed = updateChildSchema.safeParse({
    childId: formData.get("childId"),
    nick: formData.get("nick"),
    birthDate: formData.get("birthDate"),
    avatar: formData.get("avatar") ?? undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  /* Vlastnictví se neověřuje tady — hlídá ho RLS politika children_update_own.
     Kontrola v aplikaci by byla druhá pravda, která se časem rozejde s tou
     v databázi. */
  const { error } = await supabase
    .from("children")
    .update({
      nick: parsed.data.nick,
      birth_date: parsed.data.birthDate,
      avatar: parsed.data.avatar ?? "robot",
    })
    .eq("id", parsed.data.childId);

  if (error) {
    return { error: "Změny se nepodařilo uložit." };
  }

  revalidatePath("/ucet");
  return { success: "Uloženo." };
}

/* ── PIN ───────────────────────────────────────────────────────────────── */

const setPinSchema = z.object({
  childId: z.string().uuid(),
  pin: z.string(),
});

export async function setChildPinAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, userId } = await requireParent();

  const parsed = setPinSchema.safeParse({
    childId: formData.get("childId"),
    pin: formData.get("pin"),
  });

  if (!parsed.success) {
    return { error: "Neplatný vstup." };
  }

  const { childId, pin } = parsed.data;

  /* Prázdný PIN znamená zrušení — přepínač profilu se tím vrátí na jedno
     kliknutí, což je výchozí a naprosto v pořádku stav. */
  if (pin === "") {
    await clearPin(childId, userId);
    revalidatePath("/ucet");
    return { success: "PIN zrušen. Profil se přepne jedním kliknutím." };
  }

  if (!isValidPinFormat(pin)) {
    return { fieldErrors: { pin: "PIN musí být přesně 4 číslice." } };
  }
  if (isWeakPin(pin)) {
    return {
      fieldErrors: {
        pin: "Tenhle PIN je moc snadný. Zvolte jiné čtyři číslice.",
      },
    };
  }

  /* Vlastnictví se ověřuje ručně: servisní klient obchází RLS, takže by
     bez téhle kontroly šlo nastavit PIN cizímu dítěti. */
  const owned = await ownsChild(supabase, userId, childId);
  if (!owned) return { error: "Profil nenalezen." };

  const service = createServiceClient();
  const { error } = await service
    .from("children")
    .update({ pin_hash: await hashPin(pin), ...clearedLockState() })
    .eq("id", childId);

  if (error) {
    console.error("[children] Uložení PINu selhalo:", error.message);
    return { error: "PIN se nepodařilo uložit." };
  }

  revalidatePath("/ucet");
  return { success: "PIN nastaven." };
}

async function clearPin(childId: string, userId: string): Promise<void> {
  const supabase = await createClient();
  if (!(await ownsChild(supabase, userId, childId))) return;

  const service = createServiceClient();
  await service
    .from("children")
    .update({ pin_hash: null, ...clearedLockState() })
    .eq("id", childId);
}

/** Odemčení profilu rodičem po vyčerpaných pokusech. */
export async function unlockChildAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, userId } = await requireParent();

  const childId = String(formData.get("childId") ?? "");
  if (!z.string().uuid().safeParse(childId).success) {
    return { error: "Neplatný profil." };
  }
  if (!(await ownsChild(supabase, userId, childId))) {
    return { error: "Profil nenalezen." };
  }

  const service = createServiceClient();
  await service.from("children").update(clearedLockState()).eq("id", childId);

  revalidatePath("/ucet");
  return { success: "Profil odemčen." };
}

/**
 * Přepnutí profilu.
 *
 * Když má dítě PIN, musí sedět. Není to bezpečnostní hranice — obsah je
 * stejně zdarma a rodič má přístup ke všemu — ale zámek po pěti pokusech
 * z toho dělá aspoň účinnou zábranu proti sourozenci.
 */
export async function switchChildAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, userId } = await requireParent();

  const childId = String(formData.get("childId") ?? "");
  const pin = String(formData.get("pin") ?? "");

  if (!z.string().uuid().safeParse(childId).success) {
    return { error: "Neplatný profil." };
  }

  const requestHeaders = await headers();
  const limit = await rateLimit("pinVerify", `${clientIp(requestHeaders) ?? userId}:${childId}`);
  if (!limit.allowed) {
    return { error: "Příliš mnoho pokusů. Zkuste to prosím později." };
  }

  const service = createServiceClient();
  const { data: child } = await service
    .from("children")
    .select("id, nick, parent_id, pin_hash, pin_failed_attempts, pin_locked_until")
    .eq("id", childId)
    .maybeSingle();

  /* Stejná hláška pro cizí i neexistující profil — jinak by šlo zjistit,
     která id existují. */
  if (!child || child.parent_id !== userId) {
    return { error: "Profil nenalezen." };
  }

  const lockState = {
    pin_failed_attempts: child.pin_failed_attempts ?? 0,
    pin_locked_until: child.pin_locked_until ?? null,
  };

  if (isPinLocked(lockState)) {
    return {
      error: `Profil je dočasně zamčený. Zkuste to za ${PIN_LOCK_MINUTES} minut, nebo ho odemkněte v účtu.`,
    };
  }

  if (child.pin_hash) {
    const ok = await verifyPin(pin, child.pin_hash);

    if (!ok) {
      const next = nextLockState(lockState);
      await service.from("children").update(next).eq("id", childId);

      return {
        fieldErrors: {
          pin: next.pin_locked_until
            ? `Profil je na ${PIN_LOCK_MINUTES} minut zamčený.`
            : "Nesprávný PIN.",
        },
      };
    }

    await service.from("children").update(clearedLockState()).eq("id", childId);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CHILD_COOKIE, childId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  await supabase.from("learning_events").insert({
    type: EVENT.CHILD_PROFILE_SWITCHED,
    parent_id: userId,
    child_id: childId,
    props: { had_pin: Boolean(child.pin_hash) },
  });

  redirect("/ucim-se");
}

/* ── Archivace ─────────────────────────────────────────────────────────── */

export async function archiveChildAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireParent();

  const childId = String(formData.get("childId") ?? "");
  if (!z.string().uuid().safeParse(childId).success) {
    return { error: "Neplatný profil." };
  }

  /* Archivace, ne smazání. Postup a projekty zůstanou — kdyby si to rodič
     rozmyslel, jde profil vrátit. Skutečné smazání je v /ucet/smazat. */
  const { error } = await supabase
    .from("children")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", childId);

  if (error) return { error: "Profil se nepodařilo skrýt." };

  revalidatePath("/ucet");
  return { success: "Profil skryt." };
}

/* ── Pomocné ───────────────────────────────────────────────────────────── */

async function ownsChild(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  childId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("children")
    .select("id")
    .eq("id", childId)
    .eq("parent_id", userId)
    .maybeSingle();
  return Boolean(data);
}
