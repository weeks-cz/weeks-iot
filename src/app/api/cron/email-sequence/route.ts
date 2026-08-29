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

export async function GET(request: Request) {
  /* Vercel podepisuje cron požadavky hlavičkou s CRON_SECRET. Bez kontroly
     by endpoint mohl spustit kdokoli a rozeslat sekvenci mimo pořadí. */
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }
  }

  const service = createServiceClient();
  const results = { sent: 0, skipped: 0, failed: 0 };

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
          /* Zapíše se jako přeskočený, aby se to nezkoušelo každý den znovu. */
          await service.from("email_log").insert({
            parent_id: parent.id,
            step: step.id,
            ok: false,
            error: "bez souhlasu s obchodními sděleními",
          });
          results.skipped += 1;
          continue;
        }
      }

      const ctx: SequenceContext = {
        nick: child.nick,
        formal: parent.account_type !== "self",
        inCatchment: catchment.has(parent.region_code ?? ""),
        startedLearning: completedChildren.has(child.id),
      };

      const result = await sendTemplate(parent.email, buildStep(step.id, ctx));

      await service.from("email_log").insert({
        parent_id: parent.id,
        step: step.id,
        ok: result.ok,
        error: result.error ?? null,
      });

      if (result.ok) results.sent += 1;
      else results.failed += 1;
    }
  }

  console.info("[cron/email-sequence]", results);
  return NextResponse.json(results);
}
