"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { buildFbc, sendMetaEvent } from "@/lib/meta-capi";
import { SITE } from "@/lib/site";
import { EVENT } from "@/features/analytics/events";
import { consentTextsForAge } from "@/features/consent/texts";
import { adoptSession, lessonKey, mergeWithExisting } from "@/features/anon-session/adopt";
import { anonSessionSchema, type AnonSession } from "@/features/anon-session/schema";
import { fieldErrorsFrom, type ActionState } from "@/features/actions";
import { needsParentalConsent, onboardingSchema } from "./schema";

/**
 * Dokončení onboardingu.
 *
 * Účet vzniká až tady, jedním odesláním celého wizardu. Průběžné ukládání
 * po krocích by nechávalo v databázi poloviční rodiče bez kraje, bez dítěte
 * a hlavně bez souhlasu — tedy řádky, pro jejichž zpracování nemáme právní
 * základ.
 *
 * Řádek v `parents` už existuje: zakládá ho trigger `handle_new_user`
 * při vzniku uživatele. Tady se jen doplňuje.
 */

/** Anonymní relace přichází jako JSON z localStorage. Nedůvěryhodný vstup. */
function parseAnonSession(raw: FormDataEntryValue | null): AnonSession | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  /* Strop na velikost dřív, než se to vůbec zkusí parsovat — jinak by šlo
     poslat několikamegabajtový JSON a nechat server, ať se s ním pere. */
  if (raw.length > 50_000) return null;

  try {
    const parsed = anonSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function completeOnboardingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    redirect("/prihlaseni?next=%2Fregistrace%2Fonboarding");
  }

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 500) ?? null;

  const limit = await rateLimit("onboarding", ip ?? auth.user.id);
  if (!limit.allowed) {
    return { error: "Příliš mnoho pokusů. Zkuste to prosím za hodinu." };
  }

  const parsed = onboardingSchema.safeParse({
    regionCode: formData.get("regionCode"),
    childNick: formData.get("childNick"),
    childBirthDate: formData.get("childBirthDate"),
    childAvatar: formData.get("childAvatar") ?? undefined,
    /* Checkbox posílá "on" nebo nic. Převod na boolean musí být explicitní:
       schéma schválně nepřijímá řetězec, protože "false" je v JS pravdivé. */
    acceptTerms: formData.get("acceptTerms") === "on",
    parentalConsent: formData.get("parentalConsent") === "on",
    selfConsent: formData.get("selfConsent") === "on",
    marketingConsent: formData.get("marketingConsent") === "on",
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const input = parsed.data;
  const anon = parseAnonSession(formData.get("anonSession"));

  /* ── 1. Souhlasy jako první ──────────────────────────────────────────
     Pořadí je záměrné. Kdyby se nejdřív založil profil dítěte a zápis
     souhlasu pak selhal, měli bychom v databázi údaje dítěte bez právního
     základu. Opačně vznikne jen souhlas bez profilu, což je neškodné. */
  /* Věk se přepočítá na serveru z odeslaného ročníku — klient si nesmí
     vybrat, který souhlas mu stačí. */
  const isMinor = needsParentalConsent(input.childBirthDate);

  for (const text of consentTextsForAge(isMinor)) {
    const granted =
      text.kind === "terms"
        ? input.acceptTerms
        : text.kind === "parental"
          ? input.parentalConsent
          : text.kind === "self"
            ? input.selfConsent
            : input.marketingConsent;

    /* Nezaškrtnutá obchodní sdělení se nezapisují vůbec. Řádek
       granted = false by tvrdil, že člověk aktivně odmítl, zatímco on jen
       nic neudělal — a ledger má být záznam úkonů, ne domněnek. */
    if (!granted && !text.required) continue;

    const { error } = await supabase.rpc("record_consent", {
      p_kind: text.kind,
      p_version: text.version,
      p_text_snapshot: text.full,
      p_granted: granted,
      p_ip: ip,
      p_user_agent: userAgent,
    } as never);

    if (error) {
      console.error("[onboarding] Zápis souhlasu selhal:", error.message);
      return { error: "Souhlas se nepodařilo uložit. Zkuste to prosím znovu." };
    }
  }

  /* ── 2. Rodič ────────────────────────────────────────────────────────
     UTM se přepisují jen tehdy, když je relace opravdu nese. Prázdné
     hodnoty by přepsaly to, co už na řádku je. */
  const attribution = anon?.attribution ?? {};
  const { error: parentError } = await supabase
    .from("parents")
    .update({
      region_code: input.regionCode,
      onboarding_completed_at: new Date().toISOString(),
      /* Musí odpovídat druhu souhlasu zapsanému výše — z toho se pak
         řídí, jestli aplikace mluví k rodiči nebo k učícímu se. */
      account_type: isMinor ? "guardian" : "self",
      ...(attribution.utmSource ? { utm_source: attribution.utmSource } : {}),
      ...(attribution.utmMedium ? { utm_medium: attribution.utmMedium } : {}),
      ...(attribution.utmCampaign ? { utm_campaign: attribution.utmCampaign } : {}),
      ...(attribution.utmContent ? { utm_content: attribution.utmContent } : {}),
      ...(attribution.utmTerm ? { utm_term: attribution.utmTerm } : {}),
      ...(attribution.referrer ? { referrer: attribution.referrer } : {}),
      ...(attribution.landingPath ? { landing_path: attribution.landingPath } : {}),
    })
    .eq("id", auth.user.id);

  if (parentError) {
    console.error("[onboarding] Uložení rodiče selhalo:", parentError.message);
    return { error: "Účet se nepodařilo dokončit. Zkuste to prosím znovu." };
  }

  /* ── 3. Profil dítěte ────────────────────────────────────────────────
     Onboarding se dá otevřít znovu (obnovená stránka, dvojí odeslání),
     takže se nejdřív kontroluje, jestli už dítě není založené — jinak by
     vznikly dva stejné profily. */
  const { data: existingChildren } = await supabase
    .from("children")
    .select("id")
    .eq("parent_id", auth.user.id)
    .is("archived_at", null)
    .limit(1);

  let childId = existingChildren?.[0]?.id ?? null;

  if (!childId) {
    const { data: child, error: childError } = await supabase
      .from("children")
      .insert({
        parent_id: auth.user.id,
        nick: input.childNick,
        birth_date: input.childBirthDate,
        avatar: input.childAvatar ?? "robot",
      })
      .select("id")
      .single();

    if (childError || !child) {
      console.error("[onboarding] Založení profilu dítěte selhalo:", childError?.message);
      return { error: "Profil dítěte se nepodařilo založit. Zkuste to prosím znovu." };
    }
    childId = child.id;
  }

  /* ── 4. Přenos anonymního postupu ────────────────────────────────────
     Krok 6 z M2: „Nic se neztratí." Selhání přenosu ale nesmí shodit
     dokončenou registraci — účet je hotový a postup je to méně důležité
     z těch dvou. Proto se chyba jen loguje. */
  if (anon) {
    try {
      await adoptAnonymousProgress(anon, childId);
    } catch (err) {
      console.error("[onboarding] Přenos anonymního postupu selhal:", err);
    }
  }

  /* ── 5. Měření ───────────────────────────────────────────────────────
     Definice registrovaného: dokončený onboarding, ne otevřená stránka. */
  await supabase.from("learning_events").insert([
    {
      type: EVENT.SIGNUP_PARENT,
      parent_id: auth.user.id,
      anon_id: anon?.anonId ?? null,
      props: {
        region: input.regionCode,
        birth_date: input.childBirthDate,
        marketing: input.marketingConsent,
        self_managed: !isMinor,
        had_anon_progress: Boolean(anon?.lessons.length),
      },
    },
    {
      type: EVENT.CHILD_PROFILE_CREATED,
      parent_id: auth.user.id,
      child_id: childId,
      props: {},
    },
  ]);

  /* ── 6. Serverová konverze do Meta ───────────────────────────────────
     Pixel v prohlížeči vystřelí jen při přijatých cookies a ve sledovaném
     prohlížeči — iOS, blokovače a odmítnutý souhlas jsou pro něj
     neviditelné. Bez serverového měření se cena za registraci nedá
     spočítat spolehlivě, a na ní stojí vyhodnocení brány 1.

     Běží až úplně nakonec a nikdy nevyhazuje: měření je důležité,
     dokončená registrace důležitější. */
  await sendMetaEvent({
    eventName: "CompleteRegistration",
    /* Id uživatele jako eventId — prohlížečová událost pošle totéž
       a Meta ten pár sloučí, takže se registrace nepočítá dvakrát. */
    eventId: auth.user.id,
    userData: {
      email: auth.user.email ?? undefined,
      fbp: requestHeaders.get("cookie")?.match(/_fbp=([^;]+)/)?.[1],
      fbc:
        requestHeaders.get("cookie")?.match(/_fbc=([^;]+)/)?.[1] ??
        buildFbc(anon?.attribution.fbclid),
      clientIp: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    },
    customData: { contentName: "ucebna-registrace" },
    eventSourceUrl: `${SITE.url}/registrace/onboarding`,
  });

  redirect("/ucet?vitejte=1");
}

/**
 * Přenos anonymního postupu do profilu dítěte.
 *
 * Servisní klient schválně: potřebuje číst tabulku `lessons` včetně
 * nepublikovaných řádků, aby se postup neztratil jen proto, že lekci
 * mezitím někdo skryl.
 */
async function adoptAnonymousProgress(session: AnonSession, childId: string): Promise<void> {
  if (session.lessons.length === 0) return;

  const service = createServiceClient();

  const courseSlugs = [...new Set(session.lessons.map((l) => l.courseSlug))];

  /* Dva dotazy místo jednoho s joinem. Vnořený select `courses!inner(slug)`
     se opírá o metadata vztahů, která ručně psané typy nenesou — a obcházet
     to přetypováním přes `unknown` by znamenalo vypnout kontrolu právě tam,
     kde se rozhoduje, komu se připíše postup. */
  const { data: courses } = await service
    .from("courses")
    .select("id, slug")
    .in("slug", courseSlugs);

  if (!courses?.length) return;

  const courseSlugById = new Map(courses.map((c) => [c.id, c.slug] as const));

  const { data: lessons } = await service
    .from("lessons")
    .select("id, slug, course_id")
    .in("course_id", [...courseSlugById.keys()]);

  if (!lessons?.length) return;

  const lessonIdBySlug = new Map<string, string>();
  for (const row of lessons) {
    const courseSlug = courseSlugById.get(row.course_id);
    if (courseSlug) lessonIdBySlug.set(lessonKey(courseSlug, row.slug), row.id);
  }

  const { rows, skipped } = adoptSession(session, { lessonIdBySlug });
  if (skipped.length > 0) {
    console.warn("[onboarding] Přeskočené lekce (neexistují):", skipped.join(", "));
  }
  if (rows.length === 0) return;

  /* Existující postup se načte kvůli sloučení. Samotný unique index
     duplicitu ošetří, ale nezabrání tomu, aby zastaralá relace vrátila
     hotovou lekci zpět do stavu „rozdělaná". */
  const { data: existing } = await service
    .from("progress")
    .select("lesson_id, status, started_at, completed_at")
    .eq("child_id", childId)
    .in("lesson_id", rows.map((r) => r.lesson_id));

  const existingByLesson = new Map(
    (existing ?? []).map((row) => [row.lesson_id, row] as const),
  );

  const merged = rows.map((row) =>
    mergeWithExisting(row, existingByLesson.get(row.lesson_id) ?? null),
  );

  const { error } = await service
    .from("progress")
    .upsert(
      merged.map((row) => ({ ...row, child_id: childId })),
      { onConflict: "child_id,lesson_id" },
    );

  if (error) {
    console.error("[onboarding] Zápis postupu selhal:", error.message);
  }
}

/* ── Čekačka na město ──────────────────────────────────────────────────── */

const waitlistFormSchema = z.object({
  city: z.string().trim().min(2, "Zadejte město").max(80, "Název města je příliš dlouhý"),
});

export async function joinCityWaitlistAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = waitlistFormSchema.safeParse({ city: formData.get("city") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);

  const limit = await rateLimit("waitlist", ip ?? "anonym");
  if (!limit.allowed) {
    return { error: "Zkuste to prosím za hodinu." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  let regionCode: string | null = null;
  if (auth.user) {
    const { data: parent } = await supabase
      .from("parents")
      .select("region_code")
      .eq("id", auth.user.id)
      .maybeSingle();
    regionCode = parent?.region_code ?? null;
  }

  const { error } = await supabase.from("city_waitlist").insert({
    city: parsed.data.city,
    parent_id: auth.user?.id ?? null,
    email: auth.user?.email ?? null,
    region_code: regionCode,
  });

  if (error) {
    console.error("[waitlist] Zápis selhal:", error.message);
    return { error: "Nepodařilo se uložit. Zkuste to prosím znovu." };
  }

  await supabase.from("learning_events").insert({
    type: EVENT.WAITLIST_CITY_JOIN,
    parent_id: auth.user?.id ?? null,
    props: { city: parsed.data.city },
  });

  return { success: `Díky. Až budeme otevírat v místě ${parsed.data.city}, ozveme se.` };
}
