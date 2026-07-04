# Handoff: Premium subscriptions a fakturace (2026-07-04)

Tato dokumentace zachycuje stav implementace placené verze iot.weeks.cz a způsob spuštění v produkci.

> **⚠️ Dva Supabase projekty!** Repo pracuje s projektem **Učebny** (`izrskvooxsdyzwqrwhev` — účty dětí, learning_accounts/learning_events/payments; hodnota `NEXT_PUBLIC_SUPABASE_URL`). Hub projekt (`qtxiwtinwcagsyhwaeda` — kanban weeks-hub) s Učebnou NESOUVISÍ. Migrace i service klíč patří VÝHRADNĚ projektu Učebny. Server routes záměrně nečtou `SUPABASE_URL` (historicky mířil na hub).

## Aktuální stav (Part A, B, C)

### Part A: Cloud state validace + circuit breaker
- ✅ Validace bezpečného stavu (cloud-validate.ts)
- ✅ beforeunload reference fix
- ✅ circuit_save event
- ✅ PIN local-only warning (admin panel)

### Part B: Security migrace + retention cron
- ✅ Migrace 002: column-level grants (role-auth-bucket-policy)
- ✅ /api/cron/retention: denní cleanup learning_events starších než 365 dní; zároveň keep-alive proti auto-pauze Supabase free tieru
- ✅ Vercel cron (vercel.json: denně 3:00 UTC)
- ✅ Security review dokumentace (docs/2026-07-04-security-review.md)

### Part C: Premium subscriptions + fakturace
- ✅ Migrace 003: learning_accounts.plan + payments (comgate_payment_id, stav)
- ✅ Plány: 79 Kč/měsíc, 699 Kč/rok (PLANS konstanta)
- ✅ /api/payment/create — vytvoření platby, POST s Bearer token
- ✅ /api/payment/callback — Comgate webhook, aktivace plánu
- ✅ Comgate integrace (buildCreateParams, getComgateConfig)
- ✅ Fakturoid integrace (OAuth client credentials, vydávání faktur)
- ✅ Resend e-maily (transační: potvrzení, vystavění faktury)
- ✅ UpgradeModal UI (paywall)
- ✅ TaskList gating (premium-only tasks)
- ✅ /premium/dekujeme (success page)
- ✅ /premium/zruseno (cancel page)

---

## Tabulka proměnných prostředí

| Proměnná | Účel | Kde se čte | Typ |
|----------|------|-----------|-----|
| `COMGATE_MERCHANT` | Identifikátor obchodníka v Comgate | src/lib/payments/comgate.ts | Required |
| `COMGATE_SECRET` | Tajemství pro Comgate API (HMAC) | src/lib/payments/comgate.ts | Required |
| `COMGATE_TEST` | Testovací režim (default: "true") | src/lib/payments/comgate.ts, /api/payment/callback | Boolean |
| `COMGATE_METHOD` | Metody platby na bráně (default: "ALL") | src/lib/payments/comgate.ts | String |
| `NEXT_PUBLIC_SITE_URL` | Veřejná URL (return URL z Comgate) | src/app/api/payment/create/route.ts | URL |
| `FAKTUROID_SLUG` | Slug účtu v Fakturoid | src/lib/payments/fakturoid.ts | Required |
| `FAKTUROID_CLIENT_ID` | OAuth client ID (client credentials) | src/lib/payments/fakturoid.ts | Required |
| `FAKTUROID_CLIENT_SECRET` | OAuth client secret | src/lib/payments/fakturoid.ts | Required |
| `FAKTUROID_USER_AGENT` | User-Agent pro Fakturoid API (optional) | src/lib/payments/fakturoid.ts | String |
| `RESEND_API_KEY` | API klíč Resend (transakční e-maily) | src/lib/payments/email.ts | Required* |
| `RESEND_FROM` | From header (default: "Weeks <info@weeks.cz>") | src/lib/payments/email.ts | String |
| `CRON_SECRET` | Authorization secret pro /api/cron/retention | src/app/api/cron/retention/route.ts | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key projektu **Učebny** (NE hubu!) | /api/payment/create, /api/payment/callback, /api/cron/retention | Required |
| `NEXT_PUBLIC_SUPABASE_URL` | URL projektu Učebny — používají ji i server routes | klient + všechny payment/cron routes | URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key projektu Učebny | klient + /api/payment/create (ověření tokenu) | Required |

**Required* = RESEND_API_KEY není povinný (fallback chybí e-maily), ale vyžaduje se pro funčnost.*

---

## Checklist spuštění (5 kroků)

1. aplikovat migrace 002 + 003 v Supabase (SQL editor, projekt Učebny `izrskvooxsdyzwqrwhev` — NE hub!),
2. Vercel env: `AI_GATEWAY_API_KEY` (tutor), `SUPABASE_SERVICE_ROLE_KEY` (service klíč projektu Učebny z dashboardu → Settings → API), `COMGATE_*` (zprvu `COMGATE_TEST=true`), `FAKTUROID_*`, `RESEND_*`, `CRON_SECRET`; Supabase `NEXT_PUBLIC_*` proměnné přepnout na **All Environments** (ať fungují preview deploye),
3. v Comgate portálu povolit doménu iot.weeks.cz + nastavit callback URL `https://iot.weeks.cz/api/payment/callback`,
4. testovací platba v test režimu end-to-end (create → brána → callback → plan aktivní → faktura v Fakturoid testu → e-mail),
5. `COMGATE_TEST=false` + sundat noindex až při veřejném launchi.

---

## Poznamení

- **Projekt Supabase (Učebna):** izrskvooxsdyzwqrwhev — pozor, free tier se auto-pauzuje po ~7 dnech neaktivity (stalo se v červnu 2026); denní retention cron slouží i jako keep-alive, ale funguje až s nastaveným `CRON_SECRET` + service klíčem
- **Produkce:** iot.weeks.cz (Vercel)
- **Domény:** weeks.cz (Resend, ověřena v eu-west-1)
- **Comgate:** testovací režim aktivní by default (bezpečné)
- **Fakturoid:** tarif „Na lehko" — API vystavení i odeslání dokladu potvrzeno podporou
- **Cron:** denně v 3:00 UTC (vercel.json)
