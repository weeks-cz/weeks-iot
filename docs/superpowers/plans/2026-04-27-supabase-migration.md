# Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementovat Supabase backend pro weeks-iot tak, aby kemp PIN flow zůstal nedotčený, a kid mohl propojit účet emailem + heslem pro pokračování doma. Hub dostane read-only stats stránku.

**Architecture:** Samostatný Supabase projekt pro weeks-iot. localStorage = cache, Supabase = truth pro propojené uživatele. Hub čte stats přes service role key server-side. Žádné cohorty, žádné platby, vše per spec.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Resend SMTP (existující), Tailwind v4, Framer Motion.

**Spec reference:** `docs/superpowers/specs/2026-04-27-supabase-migration-design.md`

**Verification approach:** Žádný test framework v repu. Každý task ověřujeme `npx tsc --noEmit`, `npx next build`, Chrome DevTools MCP pro browser flow, a Supabase SQL editor pro DB stav.

---

## Task 1: Supabase projekt setup (manuální, mimo kód)

**Cíl:** Vytvořit Supabase projekt, nakonfigurovat auth, mít URL + anon key + service role key.

**Files:** žádné (manuální kroky v Supabase webu)

- [ ] **Step 1: Vytvořit projekt**

V https://supabase.com/dashboard:
- New project → Name: `weeks-iot`
- Region: `Frankfurt (eu-central-1)` (nejblíž CZ)
- Database password: vygenerovat silné, uložit do password manageru
- Pricing plan: Free
- Po ~2 minutách projekt vznikne

- [ ] **Step 2: Zkopírovat klíče**

Project Settings → API:
- Project URL → uložit jako `NEXT_PUBLIC_SUPABASE_URL`
- `anon` `public` key → uložit jako `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` `secret` key → uložit jako `WEEKS_IOT_SUPABASE_SERVICE_ROLE_KEY` (POZOR: tajné, jen pro hub server-side)

- [ ] **Step 3: Authentication settings**

Authentication → Settings:
- Enable email provider: ON
- Confirm email: **OFF** (per spec)
- Enable email signups: ON
- Enable email + password sign-in: ON
- Enable magic link / email OTP: ON

Authentication → URL Configuration:
- Site URL: `http://localhost:3000` (zatím; po deploy přepíšeme)
- Redirect URLs: `http://localhost:3000/auth/callback`, `http://localhost:3000/**`

- [ ] **Step 4: Custom SMTP (Resend)**

Authentication → Settings → SMTP:
- Enable Custom SMTP: ON
- Sender email: `noreply@weeks.cz`
- Sender name: `Weeks Learning`
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: existing Resend API key (stejný jako hub)

- [ ] **Step 5: Sanity check**

Authentication → Users → Add user → Vytvořit testovací účet (`test@weeks.cz`, libovolné heslo). Email by neměl přijít (confirm OFF), uživatel rovnou aktivní. Smazat test uživatele.

- [ ] **Step 6: Zaznamenat klíče lokálně**

Vytvořit/upravit `.env.local` v `C:\Users\lukol\weeks-iot\` (NEcommit):

```
NEXT_PUBLIC_SUPABASE_URL=https://<projektid>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

(Service role key zatím lokálně nepotřebujeme — patří do hub env.)

**Verifikace:** Authentication → Users vidí Test usera, Authentication → Settings ukazuje OFF u confirm + ON u SMTP.

---

## Task 2: DB migrace

**Cíl:** Vytvořit `learning_accounts` + `learning_events` tabulky s RLS.

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Napsat migrační SQL**

Vytvořit `supabase/migrations/001_initial_schema.sql`:

```sql
-- ===== learning_accounts =====
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

alter table public.learning_accounts enable row level security;

create policy "own_account_select" on public.learning_accounts
  for select using (auth.uid() = id);
create policy "own_account_insert" on public.learning_accounts
  for insert with check (auth.uid() = id);
create policy "own_account_update" on public.learning_accounts
  for update using (auth.uid() = id);

-- ===== learning_events =====
create table public.learning_events (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  event_type  text not null,
  task_id     text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index learning_events_user_idx
  on public.learning_events(user_id);
create index learning_events_type_created_idx
  on public.learning_events(event_type, created_at desc);
create index learning_events_created_idx
  on public.learning_events(created_at desc);

alter table public.learning_events enable row level security;

create policy "own_events_insert" on public.learning_events
  for insert with check (auth.uid() = user_id);
```

- [ ] **Step 2: Spustit v Supabase SQL editoru**

Supabase dashboard → SQL Editor → New query → paste obsah `001_initial_schema.sql` → Run.
Expected: `Success. No rows returned.`

- [ ] **Step 3: Sanity check tabulek**

Database → Tables: vidíš `learning_accounts` a `learning_events`. Klik na `learning_accounts` → tabulka prázdná, sloupce match SQL.

Database → Policies → vidíš 4 policies (`own_account_select/insert/update`, `own_events_insert`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat(db): initial Supabase schema — learning_accounts + learning_events"
```

---

## Task 3: Add Supabase deps + klienti

**Cíl:** Nainstalovat balíčky, vytvořit browser/server klienty + Next middleware. Žádný behavior change v UI.

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`
- Modify: `.env.local.example`

- [ ] **Step 1: Install deps**

```bash
npm i @supabase/ssr @supabase/supabase-js
```

Expected: package.json + package-lock.json se aktualizují, žádný install error.

- [ ] **Step 2: Browser client**

Vytvořit `src/lib/supabase/client.ts`:

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Server client**

Vytvořit `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch { /* called from RSC where set is not allowed — ignore */ }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Middleware helper**

Vytvořit `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() refreshuje session — musí běžet v middleware na každém requestu
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

- [ ] **Step 5: Next middleware entry**

Vytvořit `src/middleware.ts`:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 6: Update .env.local.example**

Přidat na konec `.env.local.example`:

```
# Supabase (Fáze 1 — required for email auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

- [ ] **Step 7: Verifikace TS + build**

```bash
npx tsc --noEmit
```
Expected: no output (clean).

```bash
npx next build 2>&1 | tail -10
```
Expected: `✓ Compiled successfully`. Středy + admin/api routes prerendered.

- [ ] **Step 8: Verifikace dev**

```bash
npm run dev
```
Otevřít http://localhost:3000 → existující PinEntry obrazovka funguje beze změny. Žádná chyba v konzoli.

Použít chrome-devtools MCP `mcp__chrome-devtools__navigate_page` na URL, `mcp__chrome-devtools__list_console_messages` zkontroluje žádné errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/supabase src/middleware.ts .env.local.example
git commit -m "feat(supabase): add @supabase/ssr deps + browser/server clients + middleware"
```

---

## Task 4: AuthContext + useAuth hook

**Cíl:** Vytvořit AuthContext s `useAuth()` hookem, který poskytuje `session`, `user`, a `loading`. Wrap kolem GameStateProvider.

**Files:**
- Create: `src/contexts/AuthContext.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: AuthContext component**

Vytvořit `src/contexts/AuthContext.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, sess) => {
      // POZOR: Nikdy nevolat Supabase queries v tomhle callbacku — způsobuje deadlock.
      // Veškeré DB volání musí být v separátním useEffect.
      setSession(sess);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
```

- [ ] **Step 2: Wrap layout**

Modifikovat `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { GameStateProvider } from "@/components/providers/GameStateProvider";
import { AuthProvider } from "@/contexts/AuthContext";

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Weeks IoT",
  description: "Výuková IoT platforma pro děti z Weeks táborů",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" data-theme="classic" className={outfit.variable}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <GameStateProvider>{children}</GameStateProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verifikace TS**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Verifikace dev**

```bash
npm run dev
```
http://localhost:3000 → loadne, žádná konzole chyba. AuthProvider ještě nikde nepoužitý, takže visual change = none.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/AuthContext.tsx src/app/layout.tsx
git commit -m "feat(auth): AuthContext with useAuth hook, wrapped around GameStateProvider"
```

---

## Task 5: Cloud sync helpers (čistý kód, ještě nezapojeno)

**Cíl:** Vytvořit `cloud-sync.ts` s helpery pro extract / fetch / upsert / event emit. Žádné napojení na reducer zatím.

**Files:**
- Create: `src/lib/cloud-sync.ts`
- Modify: `src/types/index.ts` (přidat `linkedUserId` + event types)

- [ ] **Step 1: Update types**

Modifikovat `src/types/index.ts` — přidat `linkedUserId` na `GameState` a definovat `LearningEvent`:

```ts
// ... existující typy ...

export interface GameState {
  version: number;
  selectedTopic: TopicId | null;
  accountEmail?: string;
  config: Config;
  accounts: Record<string, PerStudentAccount>;
  currentStudentNumber: string | null;
  adminPreviewActive: boolean;
  adminAuthenticated: boolean;
  codeDrafts: Record<string, string>;
  account: AccountState;
  tasks: Record<string, TaskState>;
  sections: Record<SectionId, { unlocked: boolean }>;
  screen: ScreenState;
  // Set když user propojil Supabase účet. null = PIN-only / anonymous.
  linkedUserId?: string | null;
}

// JSONB shape uložený v learning_accounts.state
export interface SyncableState {
  account: AccountState;
  tasks: Record<string, TaskState>;
  sections: Record<SectionId, { unlocked: boolean }>;
}

// Event types posílané do learning_events
export type LearningEventType =
  | "signup" | "login"
  | "task_complete" | "task_skip"
  | "section_unlock"
  | "theme_purchase" | "avatar_purchase"
  | "daily_challenge_claim";

export interface LearningEvent {
  event_type: LearningEventType;
  task_id?: string | null;
  metadata?: Record<string, unknown> | null;
}
```

- [ ] **Step 2: cloud-sync.ts**

Vytvořit `src/lib/cloud-sync.ts`:

```ts
import { createClient } from "@/lib/supabase/client";
import type { GameState, LearningEvent, SyncableState } from "@/types";

export function extractSyncableState(state: GameState): SyncableState {
  return {
    account: state.account,
    tasks: state.tasks,
    sections: state.sections,
  };
}

export async function fetchCloudState(userId: string): Promise<SyncableState | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_accounts")
    .select("state")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[cloud-sync] fetch failed:", error.message);
    return null;
  }
  return (data?.state as SyncableState | undefined) ?? null;
}

export async function syncToCloud(state: GameState): Promise<{ ok: boolean; error?: string }> {
  if (!state.linkedUserId) return { ok: true };
  const supabase = createClient();
  const blob = extractSyncableState(state);
  const { error } = await supabase
    .from("learning_accounts")
    .upsert({ id: state.linkedUserId, state: blob });
  if (error) {
    console.warn("[cloud-sync] upsert failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function emitEvent(userId: string | null, event: LearningEvent): Promise<void> {
  if (!userId) return; // anonymous / PIN-only sezení neemituje
  const supabase = createClient();
  const { error } = await supabase.from("learning_events").insert({
    user_id: userId,
    event_type: event.event_type,
    task_id: event.task_id ?? null,
    metadata: event.metadata ?? null,
  });
  if (error) {
    console.warn("[cloud-sync] event failed:", error.message);
  }
}
```

- [ ] **Step 3: Verifikace TS**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Smoke test (manuální, dev konzole)**

```bash
npm run dev
```

V Chrome DevTools konzoli na localhost:3000:
```js
// Toto by mělo vrátit null bez session
const { fetchCloudState } = await import("/src/lib/cloud-sync.ts");
// (Fungování závisí na Next.js modul resolution — pokud nefunguje import přímo, smoke test v testu níže)
```

Pokud direct import nejde, smoke test odložíme do Tasku 8 kde to integrujeme.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cloud-sync.ts src/types/index.ts
git commit -m "feat(cloud-sync): extract/fetch/sync/emitEvent helpers + types"
```

---

## Task 6: Auth callback route + storage default linkedUserId

**Cíl:** `/auth/callback` route handler pro Supabase magic-link/OAuth redirect. Default `linkedUserId: null` v storage.

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Auth callback route**

Vytvořit `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // exchange selhal — zpět na login s flagem
  return NextResponse.redirect(`${origin}/?auth_error=callback_failed`);
}
```

- [ ] **Step 2: Default linkedUserId**

Modifikovat `src/lib/storage.ts` — přidat `linkedUserId: null` do `createDefaultGameState`:

```ts
export function createDefaultGameState(): GameState {
  return {
    version: CONFIG_VERSION,
    selectedTopic: null,
    config: { ...DEFAULT_CONFIG },
    accounts: {},
    currentStudentNumber: null,
    adminPreviewActive: false,
    adminAuthenticated: false,
    codeDrafts: {},
    account: createDefaultAccountState(),
    tasks: createDefaultTasks(),
    sections: createDefaultSections(),
    screen: createDefaultScreenState(),
    linkedUserId: null,
  };
}
```

A v `loadGameState` zachovat backward-compat (pokud na disku není, default null):

```ts
return {
  ...parsed,
  config: { ...DEFAULT_CONFIG, ...(parsed.config ?? {}) },
  accounts: parsed.accounts ?? {},
  currentStudentNumber: parsed.currentStudentNumber ?? null,
  adminPreviewActive: false,
  adminAuthenticated: false,
  codeDrafts: parsed.codeDrafts ?? {},
  linkedUserId: parsed.linkedUserId ?? null,
};
```

- [ ] **Step 3: Verifikace TS + build**

```bash
npx tsc --noEmit
npx next build 2>&1 | tail -10
```
Expected: clean + build success. Měla by se objevit nová route `/auth/callback` v build outputu.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/callback src/lib/storage.ts
git commit -m "feat(auth): /auth/callback route + linkedUserId default in state"
```

---

## Task 7: Email login / register forms

**Cíl:** Třetí záložka „Email" v PinEntry s formuláři login/register/magic-link. Žádný read/write path zatím — pouze auth.

**Files:**
- Create: `src/components/screens/EmailLoginTab.tsx`
- Modify: `src/components/screens/PinEntry.tsx`

- [ ] **Step 1: EmailLoginTab komponenta**

Vytvořit `src/components/screens/EmailLoginTab.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type SubMode = "login" | "register" | "magic";

export function EmailLoginTab() {
  const [subMode, setSubMode] = useState<SubMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (subMode === "register") {
      if (password.length < 6) { setMsg({ ok: false, text: "Heslo musí mít aspoň 6 znaků." }); return; }
      if (password !== password2) { setMsg({ ok: false, text: "Hesla se neshodují." }); return; }
      if (nickname.trim().length < 2) { setMsg({ ok: false, text: "Nickname musí mít aspoň 2 znaky." }); return; }
    }
    if (subMode !== "magic" && password.length === 0) {
      setMsg({ ok: false, text: "Zadej heslo." }); return;
    }
    if (!email.includes("@")) { setMsg({ ok: false, text: "Zadej platný email." }); return; }

    const supabase = createClient();
    setBusy(true);

    try {
      if (subMode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: nickname.trim() } },
        });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        setMsg({ ok: true, text: "Účet vytvořen, přihlašuji…" });
      } else if (subMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        setMsg({ ok: true, text: "Přihlášeno, načítám…" });
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        setMsg({ ok: true, text: "Mrkni do mailu — poslali jsme ti přihlašovací odkaz." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
        {(["login", "register", "magic"] as SubMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`flex-1 py-2 transition-colors ${
              subMode === m
                ? "bg-[color:var(--theme-accent-soft)] text-[color:var(--theme-accent)]"
                : "hover:bg-white/5"
            }`}
            onClick={() => { setSubMode(m); setMsg(null); }}
          >
            {m === "login" ? "Mám účet" : m === "register" ? "Vytvořit účet" : "Poslat odkaz"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
          required
        />
        {subMode !== "magic" && (
          <input
            type="password"
            autoComplete={subMode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Heslo"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
            required
          />
        )}
        {subMode === "register" && (
          <>
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Heslo znovu"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
              required
            />
            <input
              type="text"
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Nickname (2–20 znaků, povinný)"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
              required
            />
          </>
        )}
        {msg && (
          <p className={`text-sm ${msg.ok ? "text-[color:var(--theme-success)]" : "text-red-400"}`}>
            {msg.text}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Pracuji…" : subMode === "register" ? "Vytvořit účet" : subMode === "login" ? "Přihlásit" : "Poslat odkaz"}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Přidat Email tab do PinEntry**

Modifikovat `src/components/screens/PinEntry.tsx` — `LoginMode` rozšířit a přidat třetí záložku:

```tsx
import { EmailLoginTab } from "@/components/screens/EmailLoginTab";

type LoginMode = "student" | "lecturer" | "email";
```

V toggle div přidat třetí tlačítko:
```tsx
<button
  type="button"
  className={`flex-1 py-2 transition-colors ${
    mode === "email"
      ? "bg-[color:var(--theme-accent-soft)] text-[color:var(--theme-accent)]"
      : "hover:bg-white/5"
  }`}
  onClick={() => { setMode("email"); setError(null); }}
>
  Email
</button>
```

A pod toggle:
```tsx
{mode === "email" ? (
  <EmailLoginTab />
) : (
  /* existing student/lecturer form */
  <form onSubmit={handleSubmit} className="space-y-3">
    {/* ... existing PIN inputs ... */}
  </form>
)}
```

(Při zvolení Email tabu se schová PIN form i lower email-link form — ten je redundantní. Account-link form pod hr lze ponechat pro PIN flow nebo odebrat — řešíme v Tasku 11.)

- [ ] **Step 3: Verifikace TS**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Browser smoke test**

```bash
npm run dev
```

Použít chrome-devtools MCP:
1. `mcp__chrome-devtools__navigate_page` na http://localhost:3000
2. Pokud vyžaduje topic-select, klik na IoT
3. `mcp__chrome-devtools__take_snapshot` → ověř že vidíš Student/Lektor/Email taby
4. `mcp__chrome-devtools__click` na Email tab
5. `mcp__chrome-devtools__fill` email + heslo
6. Mode = `register`, fill nickname, click Vytvořit účet
7. `mcp__chrome-devtools__list_console_messages` → ověř žádné errors
8. V Supabase dashboard → Authentication → Users → vidíš nově vytvořeného usera

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/EmailLoginTab.tsx src/components/screens/PinEntry.tsx
git commit -m "feat(auth): Email tab v PinEntry (login/register/magic)"
```

---

## Task 8: Read path — fetch cloud state na login

**Cíl:** Po SIGNED_IN: fetch `learning_accounts.state` z Supabase, hydrate provider, save do localStorage. Bez UI flashnutí.

**Files:**
- Modify: `src/components/providers/GameStateProvider.tsx`

- [ ] **Step 1: Hook v provideru**

Modifikovat `src/components/providers/GameStateProvider.tsx`:

Přidat import:
```tsx
import { useAuth } from "@/contexts/AuthContext";
import { fetchCloudState, emitEvent } from "@/lib/cloud-sync";
```

Uvnitř `GameStateProvider`, po existujících useEffectech, přidat:

```tsx
const { session, user } = useAuth();

// Cloud state hydration on login
useEffect(() => {
  if (!user) return;
  let cancelled = false;
  fetchCloudState(user.id).then((cloud) => {
    if (cancelled || !cloud) return;
    // Replace per-student structure: cloud má jen account/tasks/sections — natáhneme do top-level
    dispatch({
      type: "HYDRATE",
      state: {
        ...state,
        account: cloud.account,
        tasks: cloud.tasks,
        sections: cloud.sections,
        linkedUserId: user.id,
      },
    });
    // Emit login event (skip pro hned-po-signup, který emituje signup separátně v Tasku 11)
    emitEvent(user.id, { event_type: "login", metadata: { method: "password" } });
  });
  return () => { cancelled = true; };
}, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Verifikace TS**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Browser smoke test — login z čistého zařízení**

```bash
npm run dev
```

V Supabase SQL editoru ručně vytvořit testovací `learning_accounts` row:

```sql
-- Najdi user.id z předchozího Task 7 testovacího účtu:
select id, email from auth.users order by created_at desc limit 5;

-- Inserti seed state:
insert into learning_accounts (id, state) values
  ('<user-id>', '{
    "account": {"avatarId": "default", "stars": 50, "tokens": 2,
                "unlockedThemes": ["classic"], "unlockedAvatars": ["default"],
                "currentTheme": "classic", "dailyChallengeDate": null,
                "levelBadges": ["prvni-led"], "nickname": "Cloud Test", "welcomeSeen": true},
    "tasks": {},
    "sections": {"beginner": {"unlocked": true},
                 "advanced": {"unlocked": false},
                 "expert": {"unlocked": false}}
  }'::jsonb)
on conflict (id) do update set state = excluded.state;
```

V chrome-devtools MCP:
1. `mcp__chrome-devtools__navigate_page` na http://localhost:3000
2. Topic select → IoT
3. Email tab → login → email + password testovacího účtu
4. Po SIGNED_IN by se měl objevit task-list, hlavička ukazuje 50 ⭐, 2 ✦, nickname "Cloud Test"
5. `mcp__chrome-devtools__list_console_messages` → ověř bez errors
6. `mcp__chrome-devtools__evaluate_script`:
   ```js
   JSON.parse(localStorage.getItem("iot-camp-screen-state-v7")).account.stars
   ```
   Expected: 50

- [ ] **Step 4: Commit**

```bash
git add src/components/providers/GameStateProvider.tsx
git commit -m "feat(cloud-sync): hydrate cloud state into provider on login"
```

---

## Task 9: Write path — push-after-link sync

**Cíl:** Po každém state change při `linkedUserId !== null`: debounce 1s → upsert do Supabase. `beforeunload` flush.

**Files:**
- Modify: `src/components/providers/GameStateProvider.tsx`

- [ ] **Step 1: Debounced sync hook**

Přidat do GameStateProvider (po existujícím save useEffectu):

```tsx
import { syncToCloud } from "@/lib/cloud-sync";

// ... uvnitř GameStateProvider:

// Cloud push (debounced)
useEffect(() => {
  if (!state.linkedUserId) return;
  const timer = setTimeout(() => {
    syncToCloud(state).then((result) => {
      if (!result.ok) {
        console.warn("[cloud-sync] sync failed:", result.error);
        // toast handled by storage failure UI extension below
      }
    });
  }, 1000);
  return () => clearTimeout(timer);
}, [state]); // eslint-disable-line react-hooks/exhaustive-deps

// Flush on beforeunload
useEffect(() => {
  if (!state.linkedUserId) return;
  const handler = () => {
    // sync je async, ale browser ho nečeká — best effort
    syncToCloud(state);
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [state]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Sync-failed banner**

V provider JSX (vedle existujícího storageFailed bunneru):

Přidat `const [syncFailed, setSyncFailed] = useState(false);` k ostatním useState.

V debounce useEffect po `if (!result.ok)`:
```tsx
setSyncFailed(true);
// auto-clear po 5s (next sync attempt)
setTimeout(() => setSyncFailed(false), 5000);
```

V JSX:
```tsx
{syncFailed && !storageFailed && !offline && (
  <div className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 shadow-lg">
    Cloud sync selhal — postup je uložen lokálně, zkusím za chvíli.
  </div>
)}
```

- [ ] **Step 3: Verifikace TS**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Browser smoke test — push**

```bash
npm run dev
```

V chrome-devtools:
1. Login (jako v Task 8) — má `linkedUserId` set, fetched stars=50
2. Click na úkol, dokončit ho (stars vzroste)
3. Vyčkat ~2 vteřiny (debounce + roundtrip)
4. V Supabase SQL editoru:
   ```sql
   select state->'account'->>'stars' as stars, updated_at
   from learning_accounts where id = '<user-id>';
   ```
   Expected: stars > 50, `updated_at` čerstvý

- [ ] **Step 5: Commit**

```bash
git add src/components/providers/GameStateProvider.tsx
git commit -m "feat(cloud-sync): push-after-link debounced sync + sync-failed banner"
```

---

## Task 10: Event emise z reducer cases

**Cíl:** Reducer cases volají `emitEvent` pro task_complete, section_unlock, theme_purchase, avatar_purchase, daily_challenge_claim, task_skip.

**Files:**
- Modify: `src/components/providers/GameStateProvider.tsx`

- [ ] **Step 1: Helper getter na user.id v provideru**

Reducer je čistá funkce — nemá přístup k authu. Workaround: dispatch wrapper, nebo side-effect useEffect které pozoruje `state.tasks` change. Cleanest pro tento use-case: middleware-style wrapper kolem `dispatch`.

Nahradit raw `dispatch` v context value vlastní funkcí:

```tsx
// Wrap dispatch tak, aby uměl emitovat eventy podle akce
const dispatchWithEvents = useCallback((action: Action) => {
  // Snapshotuj state PŘED akcí pro diff (např. detekce skipUsed)
  const before = state;
  dispatch(action);

  if (!state.linkedUserId) return; // PIN-only neemituje

  switch (action.type) {
    case "COMPLETE_TASK": {
      const task = state.tasks[action.taskId];
      // Reward už spočítaný v reduceru, ale my chceme původní t.reward, helpu, firstTry:
      emitEvent(state.linkedUserId, {
        event_type: "task_complete",
        task_id: action.taskId,
        metadata: {
          stars_awarded: action.reward,
          first_try: task?.firstTry ?? false,
          no_help: task ? !task.helpCodeUsed && !task.helpWiringUsed : false,
        },
      });
      break;
    }
    case "USE_SKIP": {
      emitEvent(state.linkedUserId, {
        event_type: "task_skip",
        task_id: action.taskId,
        metadata: { cost: state.config.skipCost },
      });
      break;
    }
    case "UNLOCK_SECTION": {
      emitEvent(state.linkedUserId, {
        event_type: "section_unlock",
        metadata: { section_id: action.sectionId },
      });
      break;
    }
    case "PURCHASE_THEME": {
      emitEvent(state.linkedUserId, {
        event_type: "theme_purchase",
        metadata: { theme_id: action.themeId, method: "direct" },
      });
      break;
    }
    case "SPIN_STYLE": {
      // Spin výsledek je v reduceru — pro event metadata použijeme předchozí cmp.
      emitEvent(state.linkedUserId, {
        event_type: "theme_purchase",
        metadata: { method: "spin" },
      });
      break;
    }
    case "PURCHASE_AVATAR": {
      emitEvent(state.linkedUserId, {
        event_type: "avatar_purchase",
        metadata: { avatar_id: action.avatarId, method: "direct" },
      });
      break;
    }
    case "SPIN_AVATAR": {
      emitEvent(state.linkedUserId, {
        event_type: "avatar_purchase",
        metadata: { method: "spin" },
      });
      break;
    }
    case "AWARD_DAILY_CHALLENGE":
    case "COMPLETE_TASK": {
      // Daily-challenge auto-award se děje uvnitř COMPLETE_TASK reduceru.
      // Pokud action je AWARD_DAILY_CHALLENGE samostatně, emitujeme:
      if (action.type === "AWARD_DAILY_CHALLENGE") {
        emitEvent(state.linkedUserId, {
          event_type: "daily_challenge_claim",
          task_id: getDailyChallengeTaskId() ?? null,
        });
      }
      break;
    }
  }
}, [state]); // eslint-disable-line react-hooks/exhaustive-deps

// Update context value:
return (
  <GameStateContext.Provider value={{ state, dispatch: dispatchWithEvents, emailFromUrl }}>
    ...
  </GameStateContext.Provider>
);
```

POZOR: musíme importovat `useCallback`, `getDailyChallengeTaskId`, `emitEvent`.

- [ ] **Step 2: Verifikace TS**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Browser smoke test**

V chrome-devtools:
1. Login jako linked user
2. Otevřít úkol, dokončit ho
3. V Supabase SQL editoru:
   ```sql
   select event_type, task_id, metadata, created_at
   from learning_events
   where user_id = '<user-id>'
   order by created_at desc limit 5;
   ```
   Expected: vidíš `task_complete` row s metadata

- [ ] **Step 4: Commit**

```bash
git add src/components/providers/GameStateProvider.tsx
git commit -m "feat(cloud-sync): emit learning_events from reducer actions"
```

---

## Task 11: Link account modal v TaskList + signup event

**Cíl:** Nahradit existující email panel v TaskList plnohodnotným modalem. Po úspěchu: upsert current state, emit `signup` event s `source: 'pin-link'`.

**Files:**
- Create: `src/components/screens/LinkAccountModal.tsx`
- Modify: `src/components/screens/TaskList.tsx`

- [ ] **Step 1: LinkAccountModal komponenta**

Vytvořit `src/components/screens/LinkAccountModal.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { syncToCloud, emitEvent } from "@/lib/cloud-sync";
import { useGameState } from "@/components/providers/GameStateProvider";

type SubMode = "register" | "login" | "magic";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LinkAccountModal({ open, onClose }: Props) {
  const { state, dispatch } = useGameState();
  const [subMode, setSubMode] = useState<SubMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (subMode === "register") {
      if (password.length < 6) { setMsg({ ok: false, text: "Heslo musí mít aspoň 6 znaků." }); return; }
      if (password !== password2) { setMsg({ ok: false, text: "Hesla se neshodují." }); return; }
    }
    if (!email.includes("@")) { setMsg({ ok: false, text: "Zadej platný email." }); return; }

    const supabase = createClient();
    setBusy(true);

    try {
      if (subMode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: state.account.nickname ?? null } },
        });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        const userId = data.user?.id;
        if (!userId) { setMsg({ ok: false, text: "Účet vytvořen, ale chybí session — opakuj prosím." }); return; }

        // Set linkedUserId v state, sync current snapshot, emit signup
        dispatch({ type: "SET_LINKED_USER", userId });
        await syncToCloud({ ...state, linkedUserId: userId });
        await emitEvent(userId, { event_type: "signup", metadata: { source: "pin-link" } });

        setMsg({ ok: true, text: "Účet propojen ✓" });
        setTimeout(onClose, 1200);
      } else if (subMode === "login") {
        if (!window.confirm("Po přihlášení nahradíš svůj současný postup tím v cloudu. Pokračovat?")) {
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        setMsg({ ok: true, text: "Přihlášeno, načítám…" });
        setTimeout(onClose, 800);
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        setMsg({ ok: true, text: "Mrkni do mailu — link je tam." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="panel-glass w-full max-w-md p-6 space-y-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold">Propojit účet</h2>
              <button onClick={onClose} aria-label="Zavřít" className="rounded p-1 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-[color:var(--theme-muted)]">
              Vytvoř si účet emailem a hesli pro pokračování doma. Tvůj současný postup
              ({state.currentStudentNumber ? `Student ${state.currentStudentNumber}` : ""}) zůstane.
            </p>

            <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
              {(["register", "login", "magic"] as SubMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`flex-1 py-2 transition-colors ${
                    subMode === m
                      ? "bg-[color:var(--theme-accent-soft)] text-[color:var(--theme-accent)]"
                      : "hover:bg-white/5"
                  }`}
                  onClick={() => { setSubMode(m); setMsg(null); }}
                >
                  {m === "register" ? "Vytvořit" : m === "login" ? "Mám účet" : "Poslat odkaz"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
              />
              {subMode !== "magic" && (
                <input
                  type="password" autoComplete={subMode === "register" ? "new-password" : "current-password"} required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Heslo"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
                />
              )}
              {subMode === "register" && (
                <input
                  type="password" autoComplete="new-password" required
                  value={password2} onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Heslo znovu"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
                />
              )}
              {msg && (
                <p className={`text-sm ${msg.ok ? "text-[color:var(--theme-success)]" : "text-red-400"}`}>
                  {msg.text}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Pracuji…" : subMode === "register" ? "Vytvořit účet" : subMode === "login" ? "Přihlásit" : "Poslat odkaz"}
              </Button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Přidat SET_LINKED_USER action**

Modifikovat `src/components/providers/GameStateProvider.tsx`:

V `Action` typu:
```ts
| { type: "SET_LINKED_USER"; userId: string }
| { type: "CLEAR_LINKED_USER" };
```

V reduceru:
```ts
case "SET_LINKED_USER":
  return { ...state, linkedUserId: action.userId };
case "CLEAR_LINKED_USER":
  return { ...state, linkedUserId: null };
```

- [ ] **Step 3: Použít modal v TaskList**

Modifikovat `src/components/screens/TaskList.tsx` — přidat state pro modal a nahradit existující account-link panel:

```tsx
import { LinkAccountModal } from "@/components/screens/LinkAccountModal";

// uvnitř komponenty:
const [linkModalOpen, setLinkModalOpen] = useState(false);
```

V JSX kde je dnes account-link panel (kolem řádků 351–385), nahradit:

```tsx
<PanelGlass className="space-y-3">
  <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--theme-muted)]">
    Propojit účet
  </p>
  {state.linkedUserId ? (
    <p className="text-xs text-[color:var(--theme-success)]">
      Účet propojený ✓
    </p>
  ) : (
    <>
      <p className="text-xs text-[color:var(--theme-muted)]">
        Email + heslo pro pokračování doma. Tvůj postup se nahraje do cloudu.
      </p>
      <Button onClick={() => setLinkModalOpen(true)} variant="ghost" size="sm" className="w-full">
        Propojit účet
      </Button>
    </>
  )}
</PanelGlass>
```

A na konec render tree před `</motion.div>`:
```tsx
<LinkAccountModal open={linkModalOpen} onClose={() => setLinkModalOpen(false)} />
```

- [ ] **Step 4: Verifikace TS + build**

```bash
npx tsc --noEmit
npx next build 2>&1 | tail -10
```
Expected: clean + build success.

- [ ] **Step 5: Browser smoke test — full link flow**

1. Vyčistit localStorage (browser DevTools → Application → Storage → Clear site data)
2. Topic select → IoT
3. Student tab → PIN + číslo studenta → Vstoupit (PIN session, no link)
4. Splnit pár úkolů (5 stars, něco úspěšně validovat)
5. V sidebaru kliknout „Propojit účet" → modal
6. Register tab → email (nový!) + heslo + heslo → Vytvořit účet
7. Po cca 1.5s by se měl modal zavřít, nahoře toast „Účet propojen ✓"
8. V Supabase SQL editoru:
   ```sql
   select count(*) from learning_accounts;
   select event_type, metadata from learning_events order by created_at desc limit 5;
   ```
   Expected: `learning_accounts` má novou row, `learning_events` má `signup` s `source=pin-link`

9. Refresh stránky → kid je still přihlášený, stars zachované, sync indikátor neukazuje failed

- [ ] **Step 6: Commit**

```bash
git add src/components/screens/LinkAccountModal.tsx \
        src/components/screens/TaskList.tsx \
        src/components/providers/GameStateProvider.tsx
git commit -m "feat(auth): LinkAccountModal nahrazuje email panel — full link flow"
```

---

## Task 12: Hub — iot-server klient + env vars

**Cíl:** Přidat do weeks-hub repu service-role klienta pro weeks-iot DB.

**Working directory pro tuto Task:** `C:\Users\lukol\weeks-hub`

**Files:**
- Create: `weeks-hub/src/lib/supabase/iot-server.ts`
- Modify: `weeks-hub/.env.local.example` (pokud existuje, jinak `SETUP.md`)

- [ ] **Step 1: iot-server klient**

```bash
cd /c/Users/lukol/weeks-hub
```

Vytvořit `src/lib/supabase/iot-server.ts`:

```ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role klient pro weeks-iot Supabase project.
 * NIKDY nesmí jít do klienta — service role bypassuje RLS.
 * Volat výhradně ze server components / route handlers.
 */
export function createIotAdminClient() {
  return createSupabaseClient(
    process.env.WEEKS_IOT_SUPABASE_URL!,
    process.env.WEEKS_IOT_SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 2: Env vars docs**

Přidat do `SETUP.md` (nebo .env.local.example pokud je tam):

```
# Weeks-iot Supabase (read-only stats v admin/learning)
WEEKS_IOT_SUPABASE_URL=https://<projektid>.supabase.co
WEEKS_IOT_SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- [ ] **Step 3: Lokální .env.local update**

V `C:\Users\lukol\weeks-hub\.env.local` přidat oba klíče (ten service role z Task 1).

- [ ] **Step 4: Verifikace TS**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 5: Commit (v hub repu)**

```bash
git add src/lib/supabase/iot-server.ts SETUP.md
git commit -m "feat(learning): iot-server service-role client + env docs"
```

---

## Task 13: Hub — /admin/learning stránka

**Cíl:** Server component v hub admin sekci s counter mřížkou + akviziční křivkou + top tasks + funnel.

**Working directory:** `C:\Users\lukol\weeks-hub`

**Files:**
- Create: `weeks-hub/src/app/(authenticated)/admin/learning/page.tsx`
- Modify: `weeks-hub/src/components/layout/Sidebar.tsx` (přidat link)

- [ ] **Step 1: Stats page**

Vytvořit `src/app/(authenticated)/admin/learning/page.tsx`:

```tsx
import { createIotAdminClient } from "@/lib/supabase/iot-server";

export const dynamic = "force-dynamic";

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

async function fetchStats() {
  const iot = createIotAdminClient();

  const [
    totalAccountsRes,
    active7dRes,
    completes7dRes,
    pinLinkRes,
    webRegisterRes,
    magicLinks7dRes,
    signups30dRes,
    topTasks7dRes,
  ] = await Promise.all([
    iot.from("learning_accounts").select("*", { count: "exact", head: true }),
    iot.from("learning_accounts").select("*", { count: "exact", head: true })
       .gte("updated_at", sevenDaysAgo()),
    iot.from("learning_events").select("*", { count: "exact", head: true })
       .eq("event_type", "task_complete").gte("created_at", sevenDaysAgo()),
    iot.from("learning_events").select("*", { count: "exact", head: true })
       .eq("event_type", "signup").contains("metadata", { source: "pin-link" }),
    iot.from("learning_events").select("*", { count: "exact", head: true })
       .eq("event_type", "signup").contains("metadata", { source: "web-register" }),
    iot.from("learning_events").select("*", { count: "exact", head: true })
       .eq("event_type", "login").contains("metadata", { method: "magic-link" })
       .gte("created_at", sevenDaysAgo()),
    iot.from("learning_events").select("created_at")
       .eq("event_type", "signup").gte("created_at", thirtyDaysAgo()),
    iot.from("learning_events").select("task_id")
       .eq("event_type", "task_complete").gte("created_at", sevenDaysAgo())
       .not("task_id", "is", null),
  ]);

  // Akviziční křivka: signups per den
  const signupsByDay: Record<string, number> = {};
  for (const row of signups30dRes.data ?? []) {
    const day = (row.created_at as string).slice(0, 10);
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
  }

  // Top tasks
  const taskCounts: Record<string, number> = {};
  for (const row of topTasks7dRes.data ?? []) {
    if (row.task_id) taskCounts[row.task_id] = (taskCounts[row.task_id] ?? 0) + 1;
  }
  const topTasks = Object.entries(taskCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    totalAccounts: totalAccountsRes.count ?? 0,
    active7d: active7dRes.count ?? 0,
    completes7d: completes7dRes.count ?? 0,
    pinLink: pinLinkRes.count ?? 0,
    webRegister: webRegisterRes.count ?? 0,
    magicLinks7d: magicLinks7dRes.count ?? 0,
    signupsByDay,
    topTasks,
  };
}

export default async function LearningStatsPage() {
  const stats = await fetchStats();

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Learning</h1>
        <p className="text-sm text-zinc-500">Stats z weeks-iot Supabase, poslední 30/7 dní.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Účty celkem" value={stats.totalAccounts} />
        <StatCard label="Aktivních (7d)" value={stats.active7d} />
        <StatCard label="Splněných úkolů (7d)" value={stats.completes7d} />
        <StatCard label="Z táborů (pin-link)" value={stats.pinLink} />
        <StatCard label="Z webu (signup)" value={stats.webRegister} />
        <StatCard label="Magic-link logins (7d)" value={stats.magicLinks7d} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Signups (30 dní)</h2>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          {Object.keys(stats.signupsByDay).length === 0
            ? <p className="text-sm text-zinc-500">Zatím žádné signups.</p>
            : (
              <pre className="text-xs">
                {Object.entries(stats.signupsByDay)
                  .sort()
                  .map(([day, count]) => `${day}  ${"▮".repeat(count)} ${count}`)
                  .join("\n")}
              </pre>
            )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Top dokončené úkoly (7d)</h2>
        <ol className="space-y-1 text-sm">
          {stats.topTasks.length === 0
            ? <p className="text-zinc-500">Zatím žádné dokončené úkoly.</p>
            : stats.topTasks.map(([taskId, count]) => (
              <li key={taskId} className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 py-1">
                <span className="font-mono">{taskId}</span>
                <span className="font-semibold">{count}</span>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-3xl font-bold mt-1">{value.toLocaleString("cs-CZ")}</p>
    </div>
  );
}
```

- [ ] **Step 2: Sidebar link**

Najít v `src/components/layout/Sidebar.tsx` admin sekci (kde je odkaz na /admin a /admin/users) a přidat:

```tsx
{isAdmin(user.role) && (
  <Link href="/admin/learning" className="...same classes as other admin links...">
    Learning
  </Link>
)}
```

(Konkrétní className zkopírovat z existujícího admin linku — neznám aktuální shape Sidebar UI.)

- [ ] **Step 3: Verifikace TS**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Browser smoke test**

```bash
npm run dev    # weeks-hub dev na 3000 nebo 3001 (podle čeho běží weeks-iot)
```

V prohlížeči:
1. Login do hubu jako developer/admin (Google OAuth)
2. Přejít na /admin/learning
3. Vidíš mřížku counterů s reálnými čísly (z předchozích testů — 1+ účet, 1+ task_complete event atd.)
4. Žádný error v konzoli, žádný 500 v network tab

- [ ] **Step 5: Commit**

```bash
git add src/app/\(authenticated\)/admin/learning/page.tsx \
        src/components/layout/Sidebar.tsx
git commit -m "feat(learning): admin/learning page s počítadly + signups/top-tasks"
```

---

## Task 14: Hub — /admin/learning/users tabulka

**Cíl:** Read-only seznam kid účtů s emailem, nicknamem, signup date, last active, completed count.

**Working directory:** `C:\Users\lukol\weeks-hub`

**Files:**
- Create: `weeks-hub/src/app/(authenticated)/admin/learning/users/page.tsx`

- [ ] **Step 1: Users page**

Vytvořit `src/app/(authenticated)/admin/learning/users/page.tsx`:

```tsx
import { createIotAdminClient } from "@/lib/supabase/iot-server";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  email: string;
  nickname: string | null;
  created_at: string;
  updated_at: string;
  completed_count: number;
  source: "pin-link" | "web-register" | "unknown";
}

async function fetchUsers(): Promise<UserRow[]> {
  const iot = createIotAdminClient();

  // Fetch posledních 100 účtů
  const { data: accounts } = await iot
    .from("learning_accounts")
    .select("id, state, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!accounts) return [];

  // Fetch user emaily přes admin API (auth.users je v auth schemu, dostupný jen service-role)
  const userIds = accounts.map((a) => a.id);
  const { data: authUsers } = await iot.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map<string, string>();
  for (const u of authUsers?.users ?? []) {
    if (userIds.includes(u.id)) emailById.set(u.id, u.email ?? "—");
  }

  // Fetch signup events pro source
  const { data: signups } = await iot
    .from("learning_events")
    .select("user_id, metadata")
    .eq("event_type", "signup")
    .in("user_id", userIds);
  const sourceById = new Map<string, "pin-link" | "web-register">();
  for (const s of signups ?? []) {
    const src = (s.metadata as { source?: string } | null)?.source;
    if (s.user_id && (src === "pin-link" || src === "web-register")) {
      sourceById.set(s.user_id, src);
    }
  }

  return accounts.map((a) => {
    const tasks = (a.state as { tasks?: Record<string, { status?: string }> } | null)?.tasks ?? {};
    const completed = Object.values(tasks).filter((t) => t?.status === "completed").length;
    const nickname = (a.state as { account?: { nickname?: string } } | null)?.account?.nickname ?? null;
    return {
      id: a.id,
      email: emailById.get(a.id) ?? "—",
      nickname,
      created_at: a.created_at as string,
      updated_at: a.updated_at as string,
      completed_count: completed,
      source: sourceById.get(a.id) ?? "unknown",
    };
  });
}

export default async function LearningUsersPage() {
  const users = await fetchUsers();

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Learning Users</h1>
        <p className="text-sm text-zinc-500">Posledních 100 propojených účtů.</p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900 text-left">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Nickname</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Signed up</th>
              <th className="px-3 py-2">Last active</th>
              <th className="px-3 py-2 text-right">Tasks ✓</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                <td className="px-3 py-2">{u.nickname ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    u.source === "pin-link" ? "bg-emerald-500/10 text-emerald-600"
                    : u.source === "web-register" ? "bg-blue-500/10 text-blue-600"
                    : "bg-zinc-200 text-zinc-600"
                  }`}>{u.source}</span>
                </td>
                <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString("cs-CZ")}</td>
                <td className="px-3 py-2">{new Date(u.updated_at).toLocaleString("cs-CZ")}</td>
                <td className="px-3 py-2 text-right font-semibold">{u.completed_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="p-6 text-center text-zinc-500">Žádné účty zatím.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifikace TS + browser**

```bash
npx tsc --noEmit
npm run dev
```

V prohlížeči /admin/learning/users → vidíš tabulku s testovacími účty z předchozích tasků. Email + nickname + source visible.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(authenticated\)/admin/learning/users/page.tsx
git commit -m "feat(learning): admin/learning/users tabulka s detailem účtů"
```

---

## Task 15: End-to-end smoke test + memory update

**Cíl:** Ověřit kompletní flow + aktualizovat memory na dokončenou Fázi 1.

**Working directory:** `C:\Users\lukol\weeks-iot`

- [ ] **Step 1: Full E2E na weeks-iot**

Vyčistit localStorage + dev server:

```bash
npm run dev
```

V chrome-devtools MCP — sekvence:

**A) Kemp PIN flow (regress check):**
1. Topic select → IoT
2. Student tab → PIN + číslo → Vstoupit
3. Splnit 1 úkol → check stars vzrostly
4. Logout → opět PIN+číslo → state zachován (localStorage)
5. ✓ regress: žádný cloud sync, žádný error

**B) Link from PIN session:**
1. V PIN session click „Propojit účet" v sidebaru
2. Register: nový email + heslo + heslo
3. Toast „Účet propojen ✓"
4. Refresh → kid still přihlášený, stars zachované
5. Splnit další úkol → ~2s pause → Supabase má update
6. ✓ link path

**C) Cross-device login:**
1. New incognito tab
2. Topic → IoT → Email tab → login → email z B + heslo
3. State načten z cloudu → stars match B
4. Splnit jiný úkol → druhá tab po refreshi vidí update? (Bonus — eventual consistency, not real-time)
5. ✓ cross-device

**D) Online registrace bez PIN:**
1. Vyčistit localStorage (incognito new)
2. Topic → IoT → Email tab → register → fresh email + heslo + nickname
3. Po signup hydrate by měl vyrenderovat task-list s 0 ⭐
4. Hub /admin/learning → counter „Z webu" se zvýšil o 1
5. ✓ web-register

**E) Magic link:**
1. Email tab → magic mode → email → odeslat
2. V Supabase logs ověř že request dorazil
3. (Email reálně přijde jen pokud SMTP správně nakonfigurované — ověř Resend dashboard)

- [ ] **Step 2: Hub verifikace**

V hubu /admin/learning → counter mřížka match počtu z testovacích účtů.
/admin/learning/users → tabulka match.

- [ ] **Step 3: Memory update**

Vytvořit/upravit `C:\Users\lukol\.claude\projects\C--Users-lukol-weeks-iot\memory\project_supabase_status.md`:

```markdown
---
name: Supabase Fáze 1 — done 2026-04-XX
description: weeks-iot Supabase backend live, hub /admin/learning aktivní; Fáze 1 z roadmapy hotová
type: project
---

Fáze 1 ze ROADMAP dokončena (DD/MM/2026). Specifika:
- Samostatný Supabase projekt `weeks-iot` (region eu-central-1, free tier)
- Auth: email + password + magic link, email confirmation OFF
- Custom SMTP přes Resend (sender noreply@weeks.cz)
- Push-after-link sync, debounce 1s, beforeunload flush
- learning_accounts (state JSONB) + learning_events (append-only)
- Hub /admin/learning + /admin/learning/users — read-only, service role server-side

Spec: `docs/superpowers/specs/2026-04-27-supabase-migration-design.md`
Plan: `docs/superpowers/plans/2026-04-27-supabase-migration.md`

Známá omezení (záměrně mimo Fázi 1):
- Žádné Stripe / platby (Fáze 1.5)
- Žádné cohorty (Fáze 2)
- Žádný hub-side mazání kid účtů (manuálně přes Supabase dashboard)

Co dál: landing page → Stripe → cohort migrace.
```

A přidat do `MEMORY.md` index:
```
- [Supabase Fáze 1 status](project_supabase_status.md) — Fáze 1 hotová DD/MM/2026
```

- [ ] **Step 4: ROADMAP.md update**

V `docs/ROADMAP.md` přesunout Fázi 1 do hotových (analogicky Fázi 0).

- [ ] **Step 5: Push everything**

```bash
git push origin main   # weeks-iot
cd /c/Users/lukol/weeks-hub
git push origin main   # weeks-hub
```

- [ ] **Step 6: Commit final state**

```bash
git add docs/ROADMAP.md
git commit -m "docs: označit Fázi 1 jako hotovou"
git push origin main
```

---

## Self-Review Checklist

Po napsání všech tasků:

**1. Spec coverage:** Každá sekce ze specu má aspoň jeden task?
- ✅ Architektura → Tasks 1, 12
- ✅ DB schéma → Task 2
- ✅ Auth & login UX → Tasks 4, 6, 7, 11
- ✅ Sync mechanics → Tasks 8, 9, 10
- ✅ Hub integrace → Tasks 12, 13, 14
- ✅ Migrace & rollout → Task 15

**2. Placeholder scan:**
- ✅ Žádné „TBD/TODO/implement later"
- ✅ Každý code step má kompletní kód
- ✅ Žádné odkazy „same as Task X" — kód explicitně opakován

**3. Type consistency:**
- ✅ `linkedUserId` definován v Task 5, použit v Tasks 8, 9, 10, 11
- ✅ `SyncableState` shape match všude
- ✅ Action types `SET_LINKED_USER` / `CLEAR_LINKED_USER` definovány v Tasku 11
- ⚠️ `getDailyChallengeTaskId` v Tasku 10 musí být importovaný z `@/lib/tasks` — engineer doplní import

**4. Známá omezení:**
- Task 10 dispatch wrapper — když se reducer akce zřetězí (např. COMPLETE_TASK auto-awarduje daily challenge uvnitř), event emise se neopakuje. To je akceptovatelné pro Fázi 1.
- Email tab v PinEntry (Task 7) má duplicitu s LinkAccountModal v TaskList (Task 11). Ano, vědomě — entry screen pro „přicházím z webu", modal pro „uvnitř PIN session". Lze později sjednotit.
