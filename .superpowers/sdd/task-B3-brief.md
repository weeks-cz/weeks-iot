### Task B3: RLS revize — písemný závěr

**Files:**
- Create: `docs/2026-07-04-security-review.md`

- [ ] **Step 1: Projdi a zapiš** (krátký dokument, ~1 strana): tabulky × politiky × granty po 002/003, ověření že: (a) `plan` nezapisovatelný klientem, (b) `payments` bez insert/update politik pro authenticated, (c) `learning_events` insert-only, (d) service role jen v server routes (grep `SERVICE_ROLE` v `src/` — smí být jen v `src/app/api/**` a `src/lib/` serverových modulech, nikdy v client komponentách), (e) rate-limity: chat 15/min, notify-account 5/min, payment/create 10/min. Zapiš i launch checklist položku „sundat noindex až těsně před spuštěním" (nechat noindex teď).
- [ ] **Step 2: Commit** `docs(security): RLS + grants review 2026-07-04`

---

