import { createClient } from "@supabase/supabase-js";
import {
  getComgateConfig,
  isComgateConfigured,
  verifyCallbackIdentity,
  getStatus,
} from "@/lib/payments/comgate";
import { activatePremium } from "@/lib/payments/activate";
import { isPlanPeriod } from "@/lib/payments/plans";
import { isFakturoidConfigured, issuePaidInvoice } from "@/lib/payments/fakturoid";
import {
  isEmailConfigured,
  sendEmail,
  buildPremiumConfirmationEmail,
} from "@/lib/payments/email";

const respond = (code: number, message: string) =>
  new Response(`code=${code}&message=${encodeURIComponent(message)}`, {
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });

export async function POST(req: Request) {
  if (!isComgateConfigured()) return respond(1, "not configured");
  const cfg = getComgateConfig();
  const params = new URLSearchParams(await req.text());
  if (!verifyCallbackIdentity(params, cfg)) return respond(1, "identity mismatch");

  const transId = params.get("transId");
  const paymentId = params.get("refId");
  if (!transId || !paymentId) return respond(1, "missing ids");

  // Vždy projekt Učebny (viz create route) — SUPABASE_URL v repu patří hubu.
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Načti platbu a ignoruj zastaralé callbacky (superseded transakce)
  const { data: payment } = await svc
    .from("payments")
    .select(
      "id, user_id, period, amount_kc, billing_name, billing_email, status, comgate_payment_id, fakturoid_invoice_id, confirmation_sent_at, premium_activated_at"
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return respond(1, "unknown payment");
  if (payment.comgate_payment_id !== transId) return respond(0, "stale transaction ignored");

  // Nevěř callbacku — ověř stav u Comgate status API
  const status = await getStatus(transId, cfg);
  if (status === "cancelled") {
    await svc.from("payments").update({ status: "cancelled" }).eq("id", payment.id);
    return respond(0, "cancelled recorded");
  }
  if (status !== "paid") return respond(0, "still pending");
  if (!isPlanPeriod(payment.period)) return respond(1, "bad period");

  // Aktivace premium — atomický claim: premium_activated_at NULL → now().
  // Zabraňuje dvojímu prodloužení při replayi callbacku; při selhání aktivace
  // se claim uvolní a vrátíme code=1, ať to Comgate zkusí znovu.
  let expiresAt: string | null = null;
  const { data: activationClaim } = await svc
    .from("payments")
    .update({ status: "completed", premium_activated_at: new Date().toISOString() })
    .eq("id", payment.id)
    .is("premium_activated_at", null)
    .select("id");
  if (activationClaim && activationClaim.length > 0) {
    try {
      expiresAt = await activatePremium(svc, payment.user_id, payment.period);
    } catch (e) {
      console.error("[payment/callback] activation failed", e);
      await svc
        .from("payments")
        .update({ premium_activated_at: null })
        .eq("id", payment.id);
      return respond(1, "activation failed");
    }
  }

  // Faktura — idempotentní claim: fakturoid_invoice_id NULL → 'pending' → id
  if (isFakturoidConfigured() && !payment.fakturoid_invoice_id) {
    const { data: claimed } = await svc
      .from("payments")
      .update({ fakturoid_invoice_id: "pending" })
      .eq("id", payment.id)
      .is("fakturoid_invoice_id", null)
      .select("id");
    if (claimed && claimed.length > 0) {
      try {
        const invoiceId = await issuePaidInvoice({
          billingName: payment.billing_name ?? payment.billing_email ?? "Zákazník Weeks",
          billingEmail: payment.billing_email ?? "",
          paymentId: payment.id,
          planLabel:
            payment.period === "yearly"
              ? "Weeks Premium — roční"
              : "Weeks Premium — měsíční",
          priceKc: payment.amount_kc,
          sendEmail: process.env.COMGATE_TEST === "false",
        });
        await svc
          .from("payments")
          .update({ fakturoid_invoice_id: invoiceId })
          .eq("id", payment.id);
      } catch (e) {
        console.error("[payment/callback] invoice failed", e);
        await svc
          .from("payments")
          .update({ fakturoid_invoice_id: null })
          .eq("id", payment.id);
      }
    }
  }

  // Potvrzovací e-mail — idempotentní claim přes confirmation_sent_at
  // Pokud je aktivace už hotova (replay), expiresAt je null → fetch aktuální z learning_accounts
  if (!expiresAt) {
    const { data: acct } = await svc
      .from("learning_accounts")
      .select("plan_expires_at")
      .eq("id", payment.user_id)
      .maybeSingle();
    expiresAt = (acct?.plan_expires_at as string | null) ?? null;
  }

  if (isEmailConfigured() && payment.billing_email && expiresAt && !payment.confirmation_sent_at) {
    const { data: claimed } = await svc
      .from("payments")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", payment.id)
      .is("confirmation_sent_at", null)
      .select("id");
    if (claimed && claimed.length > 0) {
      try {
        const { subject, html } = buildPremiumConfirmationEmail({
          planLabel: payment.period === "yearly" ? "roční" : "měsíční",
          priceKc: payment.amount_kc,
          expiresAtIso: expiresAt,
        });
        await sendEmail({ to: payment.billing_email, subject, html });
      } catch (e) {
        console.error("[payment/callback] email failed", e);
        await svc
          .from("payments")
          .update({ confirmation_sent_at: null })
          .eq("id", payment.id);
      }
    }
  }

  return respond(0, "OK");
}
