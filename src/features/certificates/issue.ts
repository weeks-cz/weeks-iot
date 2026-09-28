import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTemplate } from "@/lib/email/send";
import { certificateEmail } from "@/lib/email/certificate";
import { EVENT } from "@/features/analytics/events";
import { certificateFileName } from "./document";
import { certificateStep } from "./eligibility";
import { renderCertificatePdf } from "./pdf";
import { earnedCertificates } from "./queries";

/**
 * Vystaví a pošle certifikáty, na které profil právě získal nárok.
 *
 * Volá se po každém zápisu dokončené lekce (i při přenosu postupu
 * z prohlížeče při registraci). Většinou nic neudělá — nárok vzniká
 * jednou za kurz.
 *
 * ── Jednou a jen jednou ─────────────────────────────────────────────────────
 * Stejný vzor jako sekvence e-mailů: nejdřív řádek v `email_log` jako
 * nárok (unikátní parent_id + step), teprve pak odeslání. Dvě dokončení
 * zapsaná těsně po sobě tak nemůžou poslat dva e-maily. Odeslaný e-mail
 * se nedá vzít zpět, zápis do logu ano.
 *
 * Nic nevyhazuje: certifikát je odměna navíc a jeho selhání nesmí rozbít
 * zápis postupu. Kdyby e-mail neodešel, certifikát zůstává ke stažení
 * v účtu — nárok se počítá z postupu, ne z logu.
 */
export async function issueEarnedCertificates(childId: string): Promise<void> {
  try {
    const service = createServiceClient();

    const { data: child } = await service
      .from("children")
      .select("id, parent_id, nick, archived_at")
      .eq("id", childId)
      .maybeSingle();
    if (!child || child.archived_at) return;

    const earned = await earnedCertificates(child.id, child.nick);
    if (earned.length === 0) return;

    const { data: parent } = await service
      .from("parents")
      .select("id, email, account_type")
      .eq("id", child.parent_id)
      .maybeSingle();
    if (!parent?.email) return;

    for (const cert of earned) {
      const step = certificateStep(cert.courseSlug, child.id);

      const { error: claimError } = await service.from("email_log").insert({
        parent_id: parent.id,
        step,
        ok: false,
        error: "odesílá se",
      });
      if (claimError) {
        /* 23505 = už vystaveno. Cokoli jiného je chyba databáze a posílat
           bez nároku by znamenalo riskovat dvojí e-mail. */
        if (claimError.code !== "23505") {
          console.error("[certificate] Nárok selhal:", claimError.message);
        }
        continue;
      }

      const { data: consented } = await service.rpc("has_consent", {
        p_parent: parent.id,
        p_kind: "marketing",
      } as never);

      let result: { ok: boolean; error?: string };
      try {
        const pdf = await renderCertificatePdf(cert.data);
        result = await sendTemplate(
          parent.email,
          certificateEmail({
            nick: child.nick,
            courseTitle: cert.data.courseTitle,
            projectTitle: cert.data.projectTitle,
            formal: parent.account_type !== "self",
            camp: Boolean(consented),
          }),
          [{ filename: certificateFileName(cert.courseSlug, child.nick), content: pdf }],
        );
      } catch (err) {
        result = { ok: false, error: err instanceof Error ? err.message : "neznámá chyba" };
      }

      await service
        .from("email_log")
        .update({ ok: result.ok, error: result.ok ? null : (result.error ?? "neznámá chyba") })
        .eq("parent_id", parent.id)
        .eq("step", step);

      await service.from("learning_events").insert({
        type: EVENT.CERTIFICATE_ISSUED,
        parent_id: parent.id,
        child_id: child.id,
        props: { course: cert.courseSlug, emailed: result.ok },
      });

      if (!result.ok) console.error("[certificate] E-mail neodešel:", result.error);
    }
  } catch (err) {
    console.error("[certificate] Vystavení selhalo:", err);
  }
}
