### Task C6: POST /api/payment/callback (webhook)

**Files:**
- Create: `src/app/api/payment/callback/route.ts`
- Create: `src/lib/payments/activate.ts`
- Test: `src/lib/payments/__tests__/activate.test.ts` (jen čistá logika — `computeNewExpiry` už testovaná; tady claim helper)

Vzor: `weeks_web/src/app/api/payment/comgate/callback/route.ts` — zachovej: verify identity → re-check přes status API → match `comgate_payment_id` → přechod stavu → idempotentní faktura/e-mail → `code=0&message=OK`.

**Interfaces:**
- Produces (activate.ts): `activatePremium(svc: SupabaseClient, userId: string, period: PlanPeriod, now?: Date): Promise<string>` — vrací nové `plan_expires_at` ISO; uvnitř: select současné expirace → `computeNewExpiry` → `upsert({ id: userId, plan: "student", plan_expires_at })`.

- [ ] **Step 1: activate.ts**

```typescript
// src/lib/payments/activate.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeNewExpiry, type PlanPeriod } from "@/lib/payments/plans";

/** Aktivuje/prodlouží premium. Volat JEN service-role klientem (plan je client-read-only). */
export async function activatePremium(
  svc: SupabaseClient,
  userId: string,
  period: PlanPeriod,
  now: Date = new Date(),
): Promise<string> {
  const { data } = await svc
    .from("learning_accounts")
    .select("plan_expires_at")
    .eq("id", userId)
    .maybeSingle();
  const newExpiry = computeNewExpiry(data?.plan_expires_at ?? null, period, now);
  const { error } = await svc
    .from("learning_accounts")
    .upsert({ id: userId, plan: "student", plan_expires_at: newExpiry });
  if (error) throw new Error(`activatePremium failed: ${error.message}`);
  return newExpiry;
}
```

- [ ] **Step 2: Callback route** — struktura (plné tělo dle weeks-web vzoru, form-urlencoded parsing):

```typescript
// src/app/api/payment/callback/route.ts
import { createClient } from "@supabase/supabase-js";
import {
  getComgateConfig, isComgateConfigured, verifyCallbackIdentity, getStatus,
} from "@/lib/payments/comgate";
import { activatePremium } from "@/lib/payments/activate";
import { isPlanPeriod } from "@/lib/payments/plans";
import { isFakturoidConfigured, issuePaidInvoice } from "@/lib/payments/fakturoid";
import {
  isEmailConfigured, sendEmail, buildPremiumConfirmationEmail,
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

  const svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Načti platbu a ignoruj zastaralé callbacky (superseded transakce)
  const { data: payment } = await svc
    .from("payments")
    .select("id, user_id, period, amount_kc, billing_name, billing_email, status, comgate_payment_id, fakturoid_invoice_id, confirmation_sent_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return respond(1, "unknown payment");
  if (payment.comgate_payment_id !== transId) return respond(0, "stale transaction ignored");
  if (payment.status === "completed") return respond(0, "already completed");

  // Nevěř callbacku — ověř stav u Comgate status API
  const status = await getStatus(transId, cfg);
  if (status === "cancelled") {
    await svc.from("payments").update({ status: "cancelled" }).eq("id", payment.id);
    return respond(0, "cancelled recorded");
  }
  if (status !== "paid") return respond(0, "still pending");
  if (!isPlanPeriod(payment.period)) return respond(1, "bad period");

  await svc.from("payments").update({ status: "completed" }).eq("id", payment.id);
  const expiresAt = await activatePremium(svc, payment.user_id, payment.period);

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
          planLabel: payment.period === "yearly" ? "Weeks Premium — roční" : "Weeks Premium — měsíční",
          priceKc: payment.amount_kc,
          sendEmail: process.env.COMGATE_TEST === "false",
        });
        await svc.from("payments").update({ fakturoid_invoice_id: invoiceId }).eq("id", payment.id);
      } catch (e) {
        console.error("[payment/callback] invoice failed", e);
        await svc.from("payments").update({ fakturoid_invoice_id: null }).eq("id", payment.id);
      }
    }
  }

  // Potvrzovací e-mail — idempotentní claim přes confirmation_sent_at
  if (isEmailConfigured() && payment.billing_email && !payment.confirmation_sent_at) {
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
        await svc.from("payments").update({ confirmation_sent_at: null }).eq("id", payment.id);
      }
    }
  }

  return respond(0, "OK");
}
```

- [ ] **Step 3: Run** `npx tsc --noEmit` + `npm test` → čisté
- [ ] **Step 4: Commit** `feat(payments): comgate callback — status re-check, plan activation, idempotent invoice+email`

