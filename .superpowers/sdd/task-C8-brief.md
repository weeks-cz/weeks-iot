### Task C8: Dokumentace, env, handoff

**Files:**
- Modify: `.env.example` (přidej COMGATE_*, FAKTUROID_*, RESEND_*, CRON_SECRET, NEXT_PUBLIC_SITE_URL)
- Create: `docs/2026-07-04-payments-handoff.md`

- [ ] **Step 1: .env.example** — přidej sekci s komentáři (bez hodnot):

```
# Platby (Comgate) — bez těchto proměnných API vrací 503, UI hlásí "platby nejsou zapnuté"
COMGATE_MERCHANT=
COMGATE_SECRET=
COMGATE_TEST=true
COMGATE_METHOD=ALL
NEXT_PUBLIC_SITE_URL=https://iot.weeks.cz
# Fakturace (Fakturoid v3, OAuth client credentials; tarif "Na lehko")
FAKTUROID_SLUG=
FAKTUROID_CLIENT_ID=
FAKTUROID_CLIENT_SECRET=
# Transakční e-maily (Resend, doména weeks.cz)
RESEND_API_KEY=
RESEND_FROM=Weeks <info@weeks.cz>
# Cron auth (retention)
CRON_SECRET=
```

- [ ] **Step 2: Handoff dokument** — co je hotové, launch checklist:
  1. aplikovat migrace 002 + 003 v Supabase (SQL editor, projekt qtxiwtinwcagsyhwaeda),
  2. Vercel env: `AI_GATEWAY_API_KEY` (tutor), `COMGATE_*` (zprvu `COMGATE_TEST=true`), `FAKTUROID_*`, `RESEND_*`, `CRON_SECRET`,
  3. v Comgate portálu povolit doménu iot.weeks.cz + nastavit callback URL `https://iot.weeks.cz/api/payment/callback`,
  4. testovací platba v test režimu end-to-end (create → brána → callback → plan aktivní → faktura v Fakturoid testu → e-mail),
  5. `COMGATE_TEST=false` + sundat noindex až při veřejném launchi.
- [ ] **Step 3: Commit** `docs(payments): env template + launch checklist handoff`

