# Supabase migrace pro weeks-iot — Fáze 1 design

> Spec pro brainstormu z 2026-04-27. Schváleno uživatelem před přechodem do writing-plans.
> Autor: Lukáš + Claude (brainstorm session).

---

## Cíl

Přidat do weeks-iot Supabase backend, který:

- **Nezlomí stávající kemp UX.** PIN + student number + localStorage zůstávají primárním flow pro tábory.
- Umožní studentovi z PIN sezení **propojit účet s emailem + heslem** a pokračovat doma.
- Umožní **online registraci** uživatele, který se k aplikaci dostane jinak než přes tábor.
- Poskytne **read-only stats** ve weeks-hub admin sekci pro tým („Learning" stránka).

Co se v této fázi **nedělá**: platby, landing page, cohorty/tábory v DB, lektor login do hubu, B2B school licenses, mazání/editace kid účtů z hubu.

---

## Architektura (high-level)

```
┌─────────────────────┐         ┌─────────────────────┐
│    weeks-iot        │         │     weeks-hub       │
│  (Next.js, public)  │         │ (Next.js, internal) │
│                     │         │                     │
│  - PIN entry        │         │  - admin/learning   │
│  - Email login/reg  │         │    (stats page)     │
│  - Task gameplay    │         │                     │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │ user auth (anon key)          │ service role (server-side only)
           │ + RLS-checked queries         │ read-only stats
           ▼                               ▼
       ┌────────────────────────────────────────┐
       │   Supabase project: weeks-iot          │
       │   ─────────────────────────────────    │
       │   auth.users  (email/password +        │
       │                magic link)             │
       │   public.learning_accounts (1:1 user)  │
       │   public.learning_events (append-only) │
       └────────────────────────────────────────┘
```

**Klíčová rozhodnutí:**

1. **Samostatný Supabase projekt pro weeks-iot.** Nesdílí se s weeks-hub kvůli `is_weeks_user()` RLS politice (hub omezený na `@weeks.cz` doménu, kid účty mají osobní emaily).
2. **Hub čte stats přes service role key** server-side. Service key nikdy nesmí do klienta.
3. **localStorage = cache, Supabase = truth** pro propojené uživatele. PIN-only sezení zůstává localStorage-only (offline-first kemp).
4. **Žádné změny ve weeks-hub auth.** Hub indigo „Learning" sekce je read-only proxy přes service role.
5. **Outage izolace.** Pád weeks-iot Supabase neovlivní hub a opačně. Pro PIN-only sezení outage Supabase nehraje vůbec roli.

---

## DB schéma

### Tabulky

```sql
-- 1. Live state (per-user JSONB blob)
create table public.learning_accounts (
  id          uuid primary key references auth.users(id) on delete cascade,
  state       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger learning_accounts_touch
  before update on public.learning_accounts
  for each row execute function public.touch_updated_at();

create index learning_accounts_updated_at_idx
  on public.learning_accounts(updated_at desc);

-- 2. Append-only analytics log
create table public.learning_events (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  event_type  text not null,
  task_id     text,           -- nullable; relevantní jen pro task_* eventy
  metadata    jsonb,           -- volný kontext
  created_at  timestamptz not null default now()
);

create index learning_events_user_idx
  on public.learning_events(user_id);
create index learning_events_type_created_idx
  on public.learning_events(event_type, created_at desc);
create index learning_events_created_idx
  on public.learning_events(created_at desc);
```

### RLS

```sql
alter table public.learning_accounts enable row level security;

create policy "own_account_select" on public.learning_accounts
  for select using (auth.uid() = id);
create policy "own_account_insert" on public.learning_accounts
  for insert with check (auth.uid() = id);
create policy "own_account_update" on public.learning_accounts
  for update using (auth.uid() = id);

alter table public.learning_events enable row level security;

create policy "own_events_insert" on public.learning_events
  for insert with check (auth.uid() = user_id);
-- Žádný SELECT policy → uživatel nečte. Service role bypassuje RLS.
```

### Co je v `learning_accounts.state`

Mirror per-student snapshotu z localStorage (`PerStudentAccount` z `src/types/index.ts`):

```ts
{
  account: AccountState,             // ⭐, ✦, avatar, theme, badges, nickname, welcomeSeen
  tasks: Record<TaskId, TaskState>,  // status/help/firstTry per task
  sections: { beginner, advanced, expert: { unlocked } }
}
```

**NE v blobu (zůstává localStorage-only):**
- `codeDrafts` — scratchpad, per-zařízení
- `config` (PINy, maxStudents) — patří lektorovi/táboru
- `adminAuthenticated`, `adminPreviewActive` — session-only
- `selectedTopic`, `currentStudentNumber` — UI/session stav

### Event types

| Event | Kdy | metadata |
|-------|-----|----------|
| `signup` | první vytvoření Supabase účtu | `{source: 'pin-link' \| 'web-register'}` |
| `login` | každé další přihlášení | `{method: 'password' \| 'magic-link'}` |
| `task_complete` | validní kód odeslán | `{stars_awarded, first_try, no_help}` |
| `task_skip` | student utratí ⭐ za skip | `{cost}` |
| `section_unlock` | advanced/expert odemčeno | `{section_id, cost}` |
| `theme_purchase` | nákup ze style shopu | `{theme_id, method: 'direct' \| 'spin'}` |
| `avatar_purchase` | avatar shop | `{avatar_id, method}` |
| `daily_challenge_claim` | denní výzva splněna | `{task_id}` |

Eventy se emitují **klientsky, fire-and-forget**. Občasná ztráta při síťovém hiccupu je akceptovatelný šum pro analytics.

### Žádný `learning_settings`

PINy a maxStudents zůstávají v localStorage tabletu. Lektor není Supabase user.

---

## Auth & login UX

### Supabase auth nastavení

- **Email confirmations: OFF.** Účet vznikne okamžitě po submitu emailu + hesla. Žádný „mrkni do mailu" dvoukrok.
- **Magic link: ENABLED.** Slouží jako (a) alternativa k heslu pro login, (b) password reset.
- **Custom SMTP: Resend** přes ověřenou `weeks.cz` doménu, sender `noreply@weeks.cz` (stejně jako hub).
- **Site URL + redirect URLs:** localhost:3000 (dev) + production URL (Vercel default URL na začátku, později `learn.weeks.cz`).

**Trade-off email confirmation OFF:** kdokoli si může zaregistrovat libovolný (i cizí) email bez ověření. Pro dětský edukační produkt bez plateb akceptováno. Při přechodu na placený tier ve Fázi 1.5 zapneme.

### Stavový stroj klienta

```
ANONYMOUS  ──PIN entry──▶  PIN_LOCAL  ──link účtu──▶  LINKED
   ▲                                                      │
   └──── logout ─────────────────────────────────────────┘
                                                          ▲
                                          email login z čistého zařízení
                                          (žádný PIN)
                                                          │
                                                    CLOUD_FRESH
```

`LINKED` a `CLOUD_FRESH` se z pohledu data flow chovají identicky.

### Entry screen (`PinEntry.tsx` rozšíření)

Tři záložky: **Student** (default), **Lektor**, **Email**.

Email záložka má 3 podstavy:
1. **„Mám účet"** — email + heslo
2. **„Vytvořit účet"** — email + heslo + heslo znovu + nickname (povinný)
3. **„Pošlete mi přihlašovací odkaz"** — email → magic link

### „Propojit účet" uvnitř PIN session

V `TaskList.tsx` nahradit existující email panel modalem:

```
[Email……………]
[Heslo (min 6 znaků)…]
[Heslo znovu………………]
[Nickname (povinný, 2–20 znaků)]
[Vytvořit účet]   |   Mám už účet → Login
[Pošlete mi přihlašovací odkaz]
```

Tok po „Vytvořit účet":
1. `supabase.auth.signUp({email, password, options.data: {nickname}})`
2. SIGNED_IN event → upsert `learning_accounts` se současným per-student snapshotem
3. Emit `signup` event s `source: 'pin-link'`
4. Set `linkedUserId` v localStorage
5. Toast „Účet propojen ✓"

Tok po „Login" (uvnitř PIN session, existující email):
1. Confirm modal: „Po přihlášení nahradíš svůj současný postup tím v cloudu. Pokračovat?"
2. `supabase.auth.signInWithPassword({email, password})`
3. Server data → localStorage REPLACE per-student snapshot
4. Emit `login` event

### Login z čistého zařízení (doma)

Stejný entry screen, Email záložka, „Mám účet". Po SIGNED_IN: fetch `learning_accounts.state`, hydrate provider, render task-list. Žádný PIN, žádné student number.

### Lektor stránka

Beze změny. Lektor PIN dál vede do `/admin`. Linked studenti v adminu mají u jména malou ikonku ✉ („propojený"). Cloud-only studenti (registrovaní online bez tábora) v lektor adminu nejsou — to je hub stránka.

---

## Sync mechanics

### Read path (mount)

```
1. localState = loadGameState()
2. supabase.auth.getSession()
   ├─ no session  → mode = PIN_LOCAL nebo ANONYMOUS, dispatch HYDRATE(localState)
   └─ session     → mode = LINKED/CLOUD_FRESH:
       a. cloudState = SELECT state FROM learning_accounts WHERE id=auth.uid()
       b. if cloudState !== null:
            dispatch HYDRATE(cloudState)
            saveGameState(cloudState)  -- refresh localStorage cache
       c. if cloudState === null:
            (signUp callback se postará o INSERT — viz auth flow)
```

### Write path

```ts
async function syncToCloud(state: GameState) {
  const session = await supabase.auth.getSession();
  if (!session) return;
  const blob = extractSyncableState(state);
  await supabase
    .from("learning_accounts")
    .upsert({ id: session.user.id, state: blob });
}
```

Volání: po každé state change nejprve `saveGameState(state)` (immediate localStorage), pak `debounce 1000ms → syncToCloud(state)`. Při `beforeunload` jeden flush bez debounce.

### Event emisi

Reducer cases volají `emitEvent({type, ...})`. `emitEvent` je fire-and-forget POST do `learning_events`. Žádný debounce — eventy mají vlastní timestamp.

### Konfliktní/edge cases

| Situace | Chování |
|---------|---------|
| Kid linknut na A, login na B (stejný email) | B sign-in → server data → localStorage B. A i B teď synchronizují. |
| Současný zápis z A i B | Last-write-wins per `updated_at`. V praxi nenastane (kid je vždy na jednom zařízení). |
| Cloud má prázdný state, lokál má kemp progress | signUp po PIN session → upload localStorage. signIn přes existing → confirm modal před replace. |
| Síť padá při syncToCloud | Toast „Sync failed, zkusím za chvíli." Příští state change retry. |
| `learning_events` POST padá | Tichý fail (analytics, ne kritické). |
| Account smazaný v Supabase | Při příštím load `cloudState === null` po sign-in → modal „Účet byl smazán." Logout. |
| Lektor reset studenta v `/admin` | Smaže jen localStorage entry. Cloud netknut. Banner: „Tablet vyčištěn lektorem. Cloud postup zůstává." |

---

## Hub integrace

### Lokace

```
weeks-hub/src/app/(authenticated)/admin/
├── learning/
│   ├── page.tsx          (server component — stats + recent activity)
│   └── users/page.tsx    (server component — tabulka kid účtů, read-only)
```

Položka „Learning" se přidá do admin sidebaru, gated `isAdmin(user.role)`.

### Klient pro hub

```ts
// weeks-hub/src/lib/supabase/iot-server.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createIotAdminClient() {
  return createSupabaseClient(
    process.env.WEEKS_IOT_SUPABASE_URL!,
    process.env.WEEKS_IOT_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

Nové env vars v hubu (Vercel project settings, Production + Preview):
```
WEEKS_IOT_SUPABASE_URL=https://xxx.supabase.co
WEEKS_IOT_SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Co stránka ukazuje

Counter mřížka (poslední 30 dní):
- Účty celkem
- Aktivních za 7 dní (`updated_at > now() - 7d`)
- Splněných úkolů (7d) (`learning_events.task_complete`, 7d)
- Z táborů (pin-link source)
- Z webu (web-register source)
- Magic-link logins (7d)

Akviziční křivka (signups per day, 30 dní).

Top tasks (7d): seznam úkolů řazený podle počtu `task_complete` eventů.

Drop-off funnel: signup → 1. úkol → 5. úkol → advanced unlock → expert unlock (procenta).

**Sub-stránka `/admin/learning/users`:** tabulka uživatelů (email, nickname, signup date, last active, completed count, source pin/web). Page-size 50, řazení, žádný edit.

### Implementace queries

JS-side agregace (Promise.all několika malých queries) pro Fázi 1. Pokud zatížení/složitost poroste, přepíšeme na Postgres RPC funkce.

### Refresh

Server component se rerenderuje na každý request. Pokud zatížení poroste: `export const revalidate = 60`.

### Co tam záměrně NENÍ

- Mazání/editace kid účtu (read-only Fáze 1; GDPR DELETE manuálně přes Supabase dashboard)
- Per-tábor cohort breakdown (žádné cohorty teď)
- Realtime updates (přehnané pro admin dashboard)
- Login pro lektora přes hub (lektor stále jede přes lektor PIN v `/admin` na tabletu)

---

## Migrace & rollout

### Pořadí prací (8 kroků)

1. **Supabase projekt setup** (mimo kód) — create projekt, custom SMTP přes Resend, email confirmation OFF, magic link enabled, redirect URLs whitelist, run migration SQL.
2. **Add deps + Supabase klienti** — `@supabase/ssr`, `@supabase/supabase-js`, `src/lib/supabase/{client,server,middleware}.ts`, `src/middleware.ts`. TS green, žádný behavior change.
3. **AuthContext + provider rozšíření** — `useAuth()` hook, GameStateProvider obalí AuthContext.
4. **Sync helpers** (čistý kód, ještě nezapojeno) — `src/lib/cloud-sync.ts`: `extractSyncableState`, `syncToCloud`, `fetchCloudState`, `emitEvent`. Manuální smoke test z konzole.
5. **Login form + entry screen** — `PinEntry.tsx` třetí záložka „Email". Forms login/register/magic. Push-after-link wire-up. Read path při mount fetchuje cloud state.
6. **Push sync ze hry** — debounce 1s, beforeunload flush, toast „Sync failed", event emisi z reducer cases.
7. **„Propojit účet" modal v TaskList** — nahradit existující email panel.
8. **Hub /admin/learning** — env vars, iot-server.ts, page.tsx, users/page.tsx.

Po kroku 5 už app reálně podporuje email auth, ale staré kemp UX je nedotčené. Kroky 6–8 jsou aditivní.

### Backwards compat

`STORAGE_KEY = "iot-camp-screen-state-v7"` zachován. `state.account` shape se nemění, jen přidáme paralelní cloud sync.

Nové top-level pole `linkedUserId: string | null` v `GameState`. Optional v typu (default null). Stará data ho nemají = treated as null.

### Local dev setup

```bash
cp .env.local.example .env.local
# Doplnit:
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
npm i
npm run dev
```

Auth flow ověřitelný proti production Supabase z lokálu (anon key je veřejný).

### Deployment

| Co | Kam | Kdy |
|----|-----|-----|
| Supabase projekt + migration | weeks-iot.supabase.co | krok 1 |
| weeks-iot Vercel project | nový (default URL → později `learn.weeks.cz`) | po kroku 5 |
| weeks-hub env vars | existing Vercel project | krok 8 |

Doména: doporučuji **`learn.weeks.cz`** (ROADMAP otevřený bod), ale pro start defaultní Vercel URL stačí.

### Rizika

| Riziko | Pravděpodobnost | Mitigace |
|--------|-----------------|----------|
| Supabase free tier limit (50k MAU) | nízká do Fáze 2 | Monitor v dashboard, upgrade na Pro $25/měs. |
| Resend SMTP rate limit | nízká | Hub už používá, bohatá kvóta pro <100 magic linků/den |
| Email typo → účet ztracen | střední | Confirm modal před submit; user vždy registruje znovu |
| Kid neumí zadat email/heslo | střední | Magic link tlačítko v signup form |
| Race v push-after-link (A i B současně) | velmi nízká | LWW per `updated_at` |
| Supabase projekt vypadne | nízká | Linked uživatelé toast „Sync failed", PIN-only kid nepostižen |
| Service role key leak | nízká | Pouze server-side env v hubu, gitignore + audit |

### Definition of done (Fáze 1)

- Kemp PIN flow funguje (žádný regress)
- Kid si zaregistruje účet z PIN session, vyloguje, na home device se přihlásí, vidí progres
- Online registrace bez PIN funguje
- Hub `/admin/learning` ukazuje reálné countery
- Magic link login funguje
- Vše deploynuté na produkci

---

## Co tato fáze nedělá (vědomě)

- Stripe / platby (Fáze 1.5)
- Landing page (Fáze 1.5 — pravděpodobně hned po Supabase)
- Cohorty/tábory v DB (Fáze 2)
- Lektor login do hubu pro správu „svého" tábora (Fáze 2)
- B2B school licenses (Fáze 2)
- Real-time multi-device collaboration
- Mazání/editace kid účtů z hubu (manuálně přes Supabase dashboard)
- Více modulů (3D tisk, programování, Blender — content gap, ne tech)
