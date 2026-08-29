import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTemplate } from "@/lib/email/send";
import { SEQUENCE, buildStep, type SequenceContext } from "@/lib/email/sequence";

/**
 * Cron sekvence po registraci.
 *
 * Běží jednou denně (viz vercel.json). Projde účty, u kterých je nějaký
 * krok sekvence na řadě, a odešle ho.
 *
 * ── Co brání dvojímu odeslání ──────────────────────────────────────────────
 * Unikátní dvojice (parent_id, step) v `email_log`. Řádek se zapisuje
 * i při neúspěchu — jinak by se odeslání zkoušelo donekonečna a člověk by
 * dostal e-mail pokaždé, když Resend chvíli zlobil.
 *
 * ── Souhlas ────────────────────────────────────────────────────────────────
 * Uvítací e-mail je provozní a chodí vždycky. Připomenutí a pozvánka na
 * tábor jsou obchodní sdělení — souhlas se kontroluje TĚSNĚ PŘED odesláním,
 * ne při registraci. Kdo ho mezitím odvolal, další e-mail nedostane.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* Sekvence může poslat desítky e-mailů; výchozí limit by ji uťal uprostřed. */
export const maxDuration = 60;

/** Kolik e-mailů nejvýš za jeden běh. Chrání limit Resendu i dobu běhu. */
const BATCH = 100;

/** `rodic@example.com` → `ro***@example.com`. Účet se pozná, adresa neunikne. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

export async function GET(request: Request) {
  /* Vercel podepisuje cron požadavky hlavičkou s CRON_SECRET.
     Chybějící tajemství znamená ODMÍTNOUT, ne pustit. Dřív tu bylo
     `if (secret) { ... }`, což je fail-open: v prostředí, kde se proměnná
     zapomene nastavit, byl endpoint otevřený — a rozeslání sekvence
     i výpis adres jsou obojí věci, které nesmí spustit kdokoli. */
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/email-sequence] Chybí CRON_SECRET — požadavek odmítnut");
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  /* ── Nácvik nasucho ──────────────────────────────────────────────────
     `?dryRun=1` projde úplně stejnou logikou, ale nic neodešle a nic
     nezapíše — jen vypíše, co by odešlo komu.

     Existuje to proto, že testování téhle routy proti ostrým datům
     poslalo 29. 8. pět uvítacích e-mailů na skutečné schránky. Cron,
     který se nedá vyzkoušet nanečisto, se bude zkoušet naostro. */
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  const service = createServiceClient();
  const results = { sent: 0, skipped: 0, failed: 0 };
  /* Do výpisu jde maskovaná adresa, ne skutečná. Na kontrolu „komu by to
     šlo" stačí poznat účet; celý seznam e-mailů registrovaných rodičů je
     osobní údaj a nemá důvod opouštět databázi kvůli diagnostice. */
  const plan: Array<{ email: string; step: string }> = [];

  const { data: parents } = await service
    .from("parents")
    .select("id, email, account_type, region_code, onboarding_completed_at")
    .not("onboarding_completed_at", "is", null)
    .is("deletion_requested_at", null)
    .order("onboarding_completed_at", { ascending: false })
    .limit(1000);

  if (!parents?.length) {
    return NextResponse.json({ ...results, note: "žádné dokončené účty" });
  }

  const ids = parents.map((p) => p.id);

  const [{ data: sentLog }, { data: children }, { data: catchmentRegions }, { data: progress }] =
    await Promise.all([
      service.from("email_log").select("parent_id, step").in("parent_id", ids),
      service
        .from("children")
        .select("parent_id, nick, id")
        .in("parent_id", ids)
        .is("archived_at", null),
      service.from("regions").select("code").eq("is_camp_catchment", true),
      service.from("progress").select("child_id").eq("status", "completed"),
    ]);

  const already = new Set((sentLog ?? []).map((r) => `${r.parent_id}:${r.step}`));
  const catchment = new Set((catchmentRegions ?? []).map((r) => r.code));
  const completedChildren = new Set((progress ?? []).map((p) => p.child_id));

  const childByParent = new Map<string, { nick: string; id: string }>();
  for (const c of children ?? []) {
    if (!childByParent.has(c.parent_id)) {
      childByParent.set(c.parent_id, { nick: c.nick, id: c.id });
    }
  }

  const now = Date.now();

  for (const parent of parents) {
    if (results.sent >= BATCH) break;

    const child = childByParent.get(parent.id);
    if (!child || !parent.email) continue;

    const completedAt = new Date(parent.onboarding_completed_at!).getTime();
    const ageDays = (now - completedAt) / 86_400_000;

    for (const step of SEQUENCE) {
      if (results.sent >= BATCH) break;
      if (already.has(`${parent.id}:${step.id}`)) continue;
      if (ageDays < step.afterDays) continue;

      if (step.requiresMarketingConsent) {
        const { data: consented } = await service.rpc("has_consent", {
          p_parent: parent.id,
          p_kind: "marketing",
        } as never);

        if (!consented) {
          results.skipped += 1;
          if (dryRun) continue;
          /* Zapíše se jako přeskočený, aby se to nezkoušelo každý den znovu. */
          await service.from("email_log").insert({
            parent_id: parent.id,
            step: step.id,
            ok: false,
            error: "bez souhlasu s obchodními sděleními",
          });
          continue;
        }
      }

      /* ── Nárok na krok PŘED odesláním ────────────────────────────────
         Řádek se zapisuje první a teprve pak se posílá e-mail. Unikátní
         dvojice (parent_id, step) tím z insertu dělá atomický nárok:
         když selže, znamená to, že krok už někdo obsloužil, a neposílá se.

         Opačné pořadí — poslat a pak zapsat — je přesně ta chyba, která
         se tu už jednou stala: zápis tiše selhával kvůli chybějícímu
         grantu a cron při každém běhu posílal totéž znovu. Odeslaný
         e-mail se nedá vzít zpět, zápis do logu ano. */
      if (dryRun) {
        plan.push({ email: maskEmail(parent.email), step: step.id });
        results.sent += 1;
        continue;
      }

      const { error: claimError } = await service.from("email_log").insert({
        parent_id: parent.id,
        step: step.id,
        ok: false,
        error: "odesílá se",
      });

      if (claimError) {
        /* Duplicita = krok už běží nebo proběhl. Cokoli jiného je chyba
           databáze a e-mail se neposílá, dokud se nevyřeší. */
        if (claimError.code !== "23505") {
          console.error("[cron/email-sequence] Nárok selhal:", claimError.message);
          results.failed += 1;
        }
        continue;
      }

      const ctx: SequenceContext = {
        nick: child.nick,
        formal: parent.account_type !== "self",
        inCatchment: catchment.has(parent.region_code ?? ""),
        startedLearning: completedChildren.has(child.id),
      };

      const result = await sendTemplate(parent.email, buildStep(step.id, ctx));

      await service
        .from("email_log")
        .update({ ok: result.ok, error: result.error ?? null, sent_at: new Date().toISOString() })
        .eq("parent_id", parent.id)
        .eq("step", step.id);

      if (result.ok) results.sent += 1;
      else results.failed += 1;
    }
  }

  console.info("[cron/email-sequence]", { dryRun, ...results });
  return NextResponse.json(dryRun ? { dryRun: true, ...results, plan } : results);
}
