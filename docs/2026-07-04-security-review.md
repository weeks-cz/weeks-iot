# Bezpečnostní revize weeks-iot — 2026-07-04

## Shrnutí

Tímto dokumentem se uzavírá bezpečnostní posílení weeks-iot aplikace po implementaci migrací 002 a připravované migrace 003 (payments). Níže se vyjadřujeme k RLS politikám, column-level grantům, service-role omezením a rate-limitům.

## Tabulky a politiky po migracích 001 + 002

### learning_accounts

**RLS politiky:**
- `own_account_select` — SELECT jen vlastního účtu (`auth.uid() = id`)
- `own_account_insert` — INSERT jen s vlastním ID (`auth.uid() = id`)
- `own_account_update` — UPDATE jen vlastního účtu (`auth.uid() = id`)

**Column-level granty (po migrace 002):**
- `authenticated` role smí: INSERT (id, state), UPDATE (state pouze)
- Bez přístupu: insert/update jiných sloupců (plan, created_at, updated_at)

**Zabezpečení sloupce `plan`:**
- `learning_accounts.plan` (migrace 003, připravuje se v tomto branchi) bude zapisovatelný JEN service rolí
- Klient (authenticated) jej nemůže ani psát, ani číst z vlastního účtu (čtení jenom prostřednictvím explicitního API)
- RLS politika pro `plan` zatím neexistuje (migrace 003 jej doplní); plánuje se `authenticated` bez přístupu, `service_role` full access

### learning_events

**RLS politiky:**
- `own_events_insert` — INSERT jen s vlastním user_id (`auth.uid() = user_id`)
- Bez SELECT/UPDATE/DELETE politik pro authenticated (fire-and-forget model)

**Column-level granty (po migrace 002):**
- `authenticated` role smí: INSERT pouze
- Bez přístupu: SELECT, UPDATE, DELETE
- Analytics se čtou via service role (cron, API routes)

**Zabezpečení retention:**
- Klient nemůže číst ani mazat events (není RLS SELECT politika)
- Service role mění events jen v `/api/cron/retention` (týdně v neděli v 03:00 UTC)
- Mezní hodnota: smaž events starší než 365 dní (GDPR data-minimisation)

## Service Role v aplikaci

**Grep ověření:**
- `SERVICE_ROLE_KEY` se vyskytuje výhradně v:
  - `src/app/api/cron/retention/route.ts` — retention cron
  - `src/lib/supabase/server.ts` — server-side client (pro API routes)
  - `src/app/api/chat/route.ts` — chat anthropic proxy
  - `src/app/api/notify-account/route.ts` — email notifikace

Všechny jsou serverové API routy nebo serverové utility, nikdy v klientských komponentách.

**Zásada:**
- Service role se používá JEN pro operace, které klient nemůže dělat
- Každý service-role přístup musí být auth-protected (`CRON_SECRET`, `AUTHORIZATION` header) nebo veřejný (chat/notify s rate-limity a host-validací)

## Rate-limity

**Aktuální limity:**

| Endpoint | Limit | Okno | Účel |
|----------|-------|------|------|
| `/api/chat` | 15 req | 60s | Anti-spam pro AI chat |
| `/api/notify-account` | 5 req | 60s | Email transport (dražší, zneužitelnější) |
| `/api/cron/retention` | auth (CRON_SECRET) | — | Cronové volání jen s Bearer token |

**Příspěvek k bezpečnosti:**
- Chat limity brání DDoS a malicious prompt flooding
- Notify limity brání spam emailům (rate limit na IP adresy)
- Cron token brání neoprávněnému spuštění mazacího job

## Tabulka `payments` (migrace 003)

Po aplikaci migrace 003 (payments — připravuje se v tomto branchi) bude bezpečnostní model:

**RLS politiky:**
- `authenticated` role: ŽÁDNÉ polítiké pro INSERT/UPDATE/DELETE (read-only či žádný přístup)
- `service_role`: full SELECT (pro reporting, refund cron, compliance audit)

**Column-level granty:**
- `authenticated`: žádné INSERT/UPDATE/DELETE (payment je jen service-role operace)
- `service_role`: SELECT, UPDATE (pro refund processing)

**Payment flow:**
- Klient inicijuje payment přes `/api/payments/create` (service role + auth check)
- Payment se vytvoří a vkládá jako service role (klient není důvěryhodný pro cenu)
- Webhook z payment providera (Comgate/Stripe) aktualizuje status
- Service role markuje kao paid/failed/pending

## Doplňkové opatření

### Noindex až do spuštění

Current `vercel.json` a `layout.tsx` mají `robots: 'noindex, nofollow'`. Toto je **správně** — udržit až do veřejného spuštění. Pak:
1. Odebrat z `layout.tsx` (nebo přesunout za feature flag)
2. Schválit v Google Search Console
3. Monitoring v GSC pro crawl errors

### Sentry integration (pending)

Logování chyb cron a API pro audit trail:
- `/api/cron/retention` by měl logovat smazaný počet do Sentry
- Payment refund cron (migrace 003) musí logovat failures

Dosud nemáme Sentry setup; připravit v launch checklistu.

## Checkl ist pro spuštění

- [ ] Migrace 002 aplikováno (column-level granty)
- [ ] Migrace 003 aplikováno (payments table + RLS)
- [ ] Retention cron běží (logs v Vercel)
- [ ] CRON_SECRET env variable nastavena v Vercel
- [ ] SUPABASE_SERVICE_ROLE_KEY nastavena a rotována (ne v source control)
- [ ] Rate-limit settings přezkoumány (chat 15/min, notify 5/min)
- [ ] Service role grep ověřen — žádná klientská použití
- [ ] Noindex odebrat z robots (před veřejným spuštěním)
- [ ] Sentry hooked pro cron error logging

## Závěr

weeks-iot aplikace má:
- ✅ RLS politiky na obou tabulkách
- ✅ Column-level granty (migrace 002)
- ✅ Service role odděleny v API routách
- ✅ Retention cron s auth-protected CRON_SECRET
- ✅ Rate-limity na spam-prone endpoints
- ⏳ Payment table zabezpečen (po migrace 003)

Aplikace je připravena pro soukromý preview a připravuje se pro veřejné spuštění.
