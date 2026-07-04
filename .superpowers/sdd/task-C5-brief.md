### Task C5: POST /api/payment/create

**Files:**
- Create: `src/app/api/payment/create/route.ts`

**Interfaces:**
- Consumes: `PLANS`, `isPlanPeriod`, `createPayment`, `isComgateConfigured`, `createRateLimiter` (z `@/lib/tutor/rate-limit`).
- Request: `{ period: "monthly"|"yearly", billingName?: string }` + header `Authorization: Bearer <supabase access token>`.
- Response 200: `{ redirectUrl: string }`; 401 bez platného tokenu; 429 rate limit; 503 když Comgate není nakonfigurovaný.

- [ ] **Step 1: Implementace**

```typescript
// src/app/api/payment/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PLANS, isPlanPeriod } from "@/lib/payments/plans";
import { createPayment, isComgateConfigured } from "@/lib/payments/comgate";
import { createRateLimiter } from "@/lib/tutor/rate-limit";

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!limiter.check(ip, Date.now()).allowed) {
    return NextResponse.json({ error: "Příliš mnoho požadavků." }, { status: 429 });
  }
  if (!isComgateConfigured()) {
    return NextResponse.json({ error: "Platby zatím nejsou zapnuté." }, { status: 503 });
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    return NextResponse.json({ error: "Server není nakonfigurovaný." }, { status: 503 });
  }

  // Ověř uživatele z access tokenu (klient je přihlášený přes Supabase auth)
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Přihlas se prosím." }, { status: 401 });
  const authClient = createClient(url, anon);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user?.email) {
    return NextResponse.json({ error: "Neplatné přihlášení." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { period?: unknown; billingName?: unknown }
    | null;
  if (!body || !isPlanPeriod(body.period)) {
    return NextResponse.json({ error: "Neplatné období předplatného." }, { status: 400 });
  }
  const period = body.period;
  const billingName =
    typeof body.billingName === "string" ? body.billingName.slice(0, 120).trim() : null;
  const plan = PLANS[period];

  const svc = createClient(url, service);
  const { data: payment, error: insertErr } = await svc
    .from("payments")
    .insert({
      user_id: user.id,
      period,
      amount_kc: plan.priceKc, // cena VŽDY server-side
      billing_name: billingName,
      billing_email: user.email,
    })
    .select("id")
    .single();
  if (insertErr || !payment) {
    return NextResponse.json({ error: "Platbu se nepodařilo založit." }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  try {
    const { transId, redirect } = await createPayment({
      paymentId: payment.id,
      priceKc: plan.priceKc,
      label: plan.label,
      email: user.email,
      returnBaseUrl: origin,
    });
    // transId ulož PŘED redirectem — jinak by callback neměl co spárovat
    const { error: updErr } = await svc
      .from("payments")
      .update({ comgate_payment_id: transId })
      .eq("id", payment.id);
    if (updErr) throw new Error(updErr.message);
    return NextResponse.json({ redirectUrl: redirect });
  } catch (e) {
    await svc.from("payments").update({ status: "cancelled" }).eq("id", payment.id);
    console.error("[payment/create]", e);
    return NextResponse.json({ error: "Platební bránu se nepodařilo oslovit." }, { status: 502 });
  }
}
```

- [ ] **Step 2: Run** `npx tsc --noEmit` → čisté
- [ ] **Step 3: Manuální test bez credů:** `npm run dev`, `curl -X POST localhost:3000/api/payment/create -H 'content-type: application/json' -d '{"period":"monthly"}'` → očekávej `503 Platby zatím nejsou zapnuté.`
- [ ] **Step 4: Commit** `feat(payments): POST /api/payment/create — auth, server-side pricing, Comgate init`

