# Stránka pro rodiče („Pošlete si odkaz na počítač“) – plán implementace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stránka `/pro-rodice`, na kterou míří reklama. Na telefonu sbírá e-mail a pošle odkaz na počítač, se souhlasem i jednu připomínku. Odhlášení funguje bez účtu a e-maily bez souhlasu se po 90 dnech mažou.

**Architecture:** Nový vertikální řez `src/features/device-link/` (schema, actions, token, link, emails, jobs, components) podle vzoru ostatních řezů. Data jsou v nové tabulce `device_link_requests` (jen servisní role) a souhlasy v ledgeru `consents` přes nový sloupec `device_link_request_id`. Připomínku a anonymizaci obsluhuje existující denní cron `/api/cron/email-sequence`. Jeden podepsaný token (HMAC, `DEVICE_LINK_SECRET`) nese odkaz v e-mailu i odhlášení.

**Tech Stack:** Next.js 16 App Router (před psaním routy/akce číst `node_modules/next/dist/docs/`), Supabase (supabase-js, servisní klient), Zod, Resend (`src/lib/email/send.ts`), Vitest, Playwright, ffmpeg (video).

**Spec:** `docs/superpowers/specs/2026-11-19-stranka-pro-rodice-design.md`

**Větev:** `feat/pro-rodice` z `main`. Rozpracovaná `fix/mobil-bloky-tazeni` se nemíchá. Commit ano, push jen na Lukášovo „pushni“.

## Global Constraints

- **⚠ Lokální prostředí je PRODUKCE.** `.env.local` míří na ostrou Supabase a ostrý Resend. Proto platí:
  - NIKDY neodesílat formulář `/pro-rodice` (ani v e2e);
  - NIKDY nevolat cron bez `?dryRun=1`;
  - NIKDY nespouštět migraci 015;
  - NIKDY nezapisovat do databáze;
  - NIKDY `git push` ani `git add -A` (přidávat jen konkrétní soubory).
- Repo: `C:\dev\weeks\weeks-iot` (absolutní cesty, žádný worktree). Úkoly běží striktně po sobě na větvi `feat/pro-rodice`.
- Repo je veřejné: do commitů nepatří výsledky reklam, rozpočty ani e-mailové adresy lidí.
- Veškerý text pro rodiče vyká. Čísla s jednotkou drží pohromadě nezlomitelnou mezerou (`\u00a0`) a pomlčka je krátká „–“.
- Stránka smí tvrdit jen tohle: zdarma, nic se neinstaluje, v prohlížeči, 7 lekcí po 20–30 minutách, certifikát, první lekce bez účtu, pro děti od 9 let. Nic dalšího (žádné „uvidíte postup dítěte“, žádné počty).
- Zápis jen přes Server Actions se Zod validací (AGENTS.md). Soubory s `"use server"` exportují jen async funkce.
- `device_link_requests`: RLS zapnuté, žádný grant pro `anon` ani `authenticated`. Píše jen servisní role.
- Na server jde e-mail, zdroj návštěvy (UTM, referrer, env) a souhlas. **Žádné `anon_id`** ani postup lekcí.
- Odkaz v e-mailu: `/kurz/iot/rozsvit-ledku/` s původním UTM, `utm_term=odkaz-na-pc` (připomínka `pripominka-na-pc`) a `odkaz=<token>`. Bez původního UTM se použije `utm_source=ucebna&utm_medium=email&utm_campaign=odkaz-na-pc`.
- `opened_at` = první otevření odkazu **na počítači** (klient pošle `device: "computer"`, když `matchMedia("(pointer: coarse)")` neplatí). Otevření na telefonu se zapíše jen jako událost a připomínku nezruší.
- Události kolem odkazu (`device_link_submit`, `device_link_open`) zapisuje **server bez `anon_id`**, ne klientský `track()`.
- Parametr `odkaz` se po zachycení odstraní z URL (`history.replaceState`) a `captureAttribution` ho nesmí uložit do `landingPath`.
- Připomínka: jen se souhlasem, `sent_at` vyplněné, `opened_at`/`reminder_sent_at`/`unsubscribed_at`/`anonymized_at` prázdné, stáří 48 h – 7 dní, pro e-mail bez účtu v `parents`. Nejvýš jedna.
- Anonymizace: řádek bez platného souhlasu (nikdy nedán nebo odhlášen) starší 90 dní → `email = null`, `anonymized_at = now()`.
- Meta: Pixel `Lead` v prohlížeči (jen po souhlasu s cookies, `pixelAllowedFor('/pro-rodice')` je true). CAPI `Lead` jen při marketingovém souhlasu, se stejným `eventId`.
- Stránka `/pro-rodice` má `robots: { index: false }`.

## Review Focus

1. **Dvojí ťuknutí nebo opakované odeslání stejné adresy během 10 minut** má poslat jen jeden e-mail a ukázat totéž „hotovo“ (Task 4, test `dedupes resend within 10 minutes`).
2. **Velká písmena a mezery v e-mailu** („ Jana@Seznam.CZ “) se před uložením i porovnáním s `parents` normalizují (Task 4 a Task 6, testy `normalizes email` a `skips registered email regardless of case`).
3. **Bez JavaScriptu nebo s pomalou hydratací** musí HTML obsahovat formulář i odkaz do lekce, na počítači i na telefonu (Task 7, test `server HTML contains form and lesson link`).
4. **Odhlašovací odkaz u anonymizované nebo už odhlášené žádosti** ukáže klidné „hotovo“, nespadne a nic nezapíše (Task 5, test `unsubscribe of anonymized request is a no-op`).
5. **Odkaz otevřený znovu na telefonu** (rodič klepne v mailu na mobilu) nesmí přepsat `opened_at` druhým otevřením. Událost `device_link_open` nese `env`, aby se otevření na telefonu dalo odlišit (Task 5, test `opened_at is set once`).

---

### Task 1: Migrace 015 a typy

**Files:**
- Create: `supabase/migrations/015_ucebna_odkaz_na_pc.sql`
- Modify: `src/lib/supabase/types.ts` (nový `DeviceLinkRequestRow`, `ConsentRow.device_link_request_id`, tabulka v `Database`)
- Test: `src/features/device-link/__tests__/migration.test.ts`

**Interfaces:**
- Produces: tabulka `public.device_link_requests` se sloupci podle specu §5.1 (`email citext` nullable, `utm_source/medium/campaign/content/term text`, `referrer text`, `env text`, `marketing_consent boolean not null default false`, `sent_at`, `send_error`, `opened_at`, `reminder_sent_at`, `unsubscribed_at`, `anonymized_at`, `created_at`) + check `(email is not null) or (anonymized_at is not null)`. Index `(lower(email::text), created_at desc)`. `consents.device_link_request_id uuid references device_link_requests(id) on delete set null`. Typ `DeviceLinkRequestRow` v `types.ts`.

- [ ] **Step 1: Napsat test, který čte migraci jako text** (vzor `consent/__tests__/retention.test.ts`). Asserty: `create table public.device_link_requests`, `enable row level security`, regex `/grant[^;]*device_link_requests[^;]*to (anon|authenticated)/` NEmatchuje, `add column device_link_request_id uuid references public.device_link_requests\(id\) on delete set null`, check constraint na e-mail/anonymizaci.
- [ ] **Step 2:** `npm test -- migration` → FAIL (soubor neexistuje).
- [ ] **Step 3:** Napsat migraci s hlavičkovým komentářem ve stylu 013/014 (proč, co se mění, „spustit PŘED nasazením kódu“) a doplnit typy.
- [ ] **Step 4:** `npm test -- migration` → PASS; `npx tsc --noEmit` → bez chyb.
- [ ] **Step 5: Commit** `feat(odkaz-na-pc): migrace 015 – žádosti o odkaz na počítač`

### Task 2: Podepsaný token a sestavení odkazu

**Files:**
- Create: `src/features/device-link/token.ts`, `src/features/device-link/link.ts`
- Test: `src/features/device-link/__tests__/token.test.ts`, `src/features/device-link/__tests__/link.test.ts`

**Interfaces:**
- Produces:
  - `signRequestId(id: string, secret: string): string`: formát `<id>.<base64url(hmac-sha256(id))>`.
  - `verifyRequestToken(token: string, secret: string): string | null`: vrátí `id`, nebo null při špatném tvaru či podpisu. Porovnání přes `timingSafeEqual`.
  - `requestTokenSecret(): string`: čte `DEVICE_LINK_SECRET` a při chybějící hodnotě vyhodí (fail-closed).
  - `type LinkAttribution = { utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string }`
  - `buildLessonLink(a: LinkAttribution, token: string, term: "odkaz-na-pc" | "pripominka-na-pc", origin?: string): string` (origin default `SITE.url`).
  - `buildUnsubscribeLink(token: string, origin?: string): string` → `<origin>/odhlasit?t=<token>`.

- [ ] **Step 1: Testy.**
  - `token`: round-trip, změněný podpis → null, cizí secret → null, nesmysl `"abc"` → null.
  - `link`: s UTM (`meta/paid/ucebna-seed-2026-11/video-v6-reel-rodice`) zachová všechny čtyři hodnoty a nastaví `utm_term=odkaz-na-pc` a `odkaz=<token>` na cestě `/kurz/iot/rozsvit-ledku/`. Bez UTM dosadí `ucebna/email/odkaz-na-pc`. Zadané `utm_term` z atribuce se vždy přepíše.
- [ ] **Step 2:** Spustit → FAIL.
- [ ] **Step 3:** Implementovat (`node:crypto`, `URL` + `searchParams.set`, `server-only` v `token.ts`).
- [ ] **Step 4:** Spustit → PASS.
- [ ] **Step 5: Commit** `feat(odkaz-na-pc): podepsaný token a odkaz do lekce`

### Task 3: Texty e-mailů, souhlasu a hlavička List-Unsubscribe

**Files:**
- Create: `src/features/device-link/emails.ts`
- Modify: `src/features/consent/texts.ts` (nový `DEVICE_LINK_MARKETING_TEXT`, **nepřidávat** do `CONSENT_TEXTS`), `src/lib/email/send.ts` (volitelný 4. parametr `headers?: Record<string, string>` sloučený do odesílaných hlaviček)
- Test: `src/features/device-link/__tests__/emails.test.ts`

**Interfaces:**
- Produces:
  - `deviceLinkEmail(p: { lessonUrl: string; unsubscribeUrl: string | null }): EmailTemplate`: předmět „Odkaz na Učebnu Weeks pro vaše dítě“, tlačítko „Otevřít učebnu“. Odstavce: co dítě potřebuje (počítač nebo notebook, ideálně myš, asi 20 minut) a že první lekce jde bez účtu, ale postup a certifikát potřebují účet rodiče. Footnote: „Požádali jste o odkaz na ucebna.weeks.cz…“ a s `unsubscribeUrl` navíc věta s odkazem „Nechci další e-maily“.
  - `deviceLinkReminderEmail(p: { lessonUrl: string; unsubscribeUrl: string }): EmailTemplate`: předmět „Dítě se k učebně ještě nedostalo?“, krátký text, stejné tlačítko a odkaz na odhlášení.
  - `DEVICE_LINK_MARKETING_TEXT: ConsentText`: `kind: "marketing"`, `version: "marketing-odkaz-v1"`, `required: false`. Label: „Pošlete mi jednou připomínku, kdyby se dítě k učebně nedostalo, a občas tip z učebny nebo nabídku táborů Weeks.“ Plné znění ve stylu `MARKETING_TEXT` (správce, účel, odvolání odkazem v každém e-mailu, právní základ, dobrovolnost). Bez věty o Meta CAPI se tam CAPI nesmí poslat, takže věta o předání hashe do Meta **musí být součástí** (jako u `marketing-v3`).
  - `sendTemplate(to, template, attachments?, headers?)`

- [ ] **Step 1: Testy.** Šablony nemají vykřičník. Footnote obsahuje unsubscribe URL jen když je předaná. Text neobsahuje „uvidíte“ ani „postup dítěte“. `DEVICE_LINK_MARKETING_TEXT` není v `CONSENT_TEXTS` a `consentTextsForAge(true)` vrací stejný počet jako před změnou.
- [ ] **Step 2:** FAIL → **Step 3:** implementace (renderování v `layout.ts` escapuje, URL se proto nedává do HTML, ale jako text, nebo jako druhý `button`, pokud to `EmailContent` neumí, přidat volitelné `secondaryLink?: { label: string; url: string }` do `EmailContent` a obou rendererů) → **Step 4:** PASS + `npm test -- sequence-plan certificate` beze změny.
- [ ] **Step 5: Commit** `feat(odkaz-na-pc): e-maily, souhlas a List-Unsubscribe`

### Task 4: Server Action – žádost o odkaz

**Files:**
- Create: `src/features/device-link/schema.ts`, `src/features/device-link/actions.ts`, `src/features/device-link/request.ts` (serverová logika mimo `"use server"`, aby šla testovat)
- Modify: `src/lib/rate-limit.ts` (`deviceLinkIp: { limit: 5, windowMs: 3_600_000 }`, `deviceLinkEmail: { limit: 3, windowMs: 3_600_000 }`)
- Test: `src/features/device-link/__tests__/schema.test.ts`, `src/features/device-link/__tests__/request.test.ts`

**Interfaces:**
- Consumes: `signRequestId`, `requestTokenSecret`, `buildLessonLink`, `buildUnsubscribeLink` (Task 2), `deviceLinkEmail`, `DEVICE_LINK_MARKETING_TEXT`, `sendTemplate` (Task 3), `rateLimit`, `clientIp`, `sendMetaEvent`, `buildFbc`.
- Produces:
  - `deviceLinkFormSchema` (Zod): `email` (trim, lowercase, `.email()`, max 254, hláška „Zkontrolujte prosím e-mail.“), `marketingConsent` (`"on"` → true), `website` (honeypot, musí být prázdné), `utmSource|utmMedium|utmCampaign|utmContent|utmTerm` (volitelné, max 200), `referrer` (max 500), `env` (`facebook|instagram|browser|unknown`), `fbclid` (max 255), `eventId` (uuid).
  - `handleDeviceLinkRequest(input: DeviceLinkInput, ctx: { ip: string | null; userAgent: string | null; fbp?: string; now?: Date; deps?: Partial<Deps> }): Promise<{ ok: true; email: string }>`: logika s injektovatelnými závislostmi (`service`, `send`, `meta`, `limit`) kvůli testům.
  - `requestDeviceLink(_prev: ActionState, formData: FormData): Promise<ActionState>` v `actions.ts`: tenký obal, `success` je „Hotovo. Odkaz je na cestě na {email}. Otevřete ho na počítači.“

Pořadí v `handleDeviceLinkRequest`:
1. Honeypot vyplněný → `ok` bez zápisu.
2. Rate limit na IP, pak na e-mail. Při překročení se vrací chyba „Zkuste to prosím za hodinu.“
3. Dedupe: řádek se stejným e-mailem, `sent_at` za posledních 10 minut → `ok` bez dalšího e-mailu. **Pokud ale tentokrát přišel souhlas a ten řádek ho nemá, souhlas se zapíše k existujícímu řádku** (consent insert + `marketing_consent = true`).
4. Insert řádku.
5. Se souhlasem se zapíše řádek do `consents` (`kind marketing`, `version`, `text_snapshot = full`, `granted true`, `ip`, `user_agent`, `device_link_request_id`, `parent_id null`).
6. Odeslání (`List-Unsubscribe: <unsubscribeUrl>` jen se souhlasem).
7. Update `sent_at` nebo `send_error`.
8. Se souhlasem `sendMetaEvent({ eventName: "Lead", eventId, userData: { email, fbp, fbc: buildFbc(fbclid), clientIp, userAgent }, eventSourceUrl: SITE.url + "/pro-rodice" })` přes `after()`.
9. Událost `device_link_submit` do `learning_events` (props `env`, `consent`, bez e-mailu).

- [ ] **Step 1: Testy.**
  - `schema`: normalizes email (`" Jana@Seznam.CZ "` → `"jana@seznam.cz"`), neplatný e-mail → fieldError `email`, UTM delší než 200 se odmítne.
  - `request` s fake deps:
    - honeypot → `send` nevolán;
    - souhlas → consent insert s `device_link_request_id` a `List-Unsubscribe` v hlavičkách;
    - bez souhlasu → žádný consent řádek, žádný `meta`, žádná hlavička;
    - `send` vrátí `{ ok: false, error: "x" }` → výsledek `ok`, update `send_error: "x"`;
    - dedupes resend within 10 minutes;
    - dedupe se souhlasem napodruhé → consent zapsán k existujícímu řádku, e-mail neodejde;
    - rate limit e-mailu → chyba.
- [ ] **Step 2:** FAIL → **Step 3:** implementace → **Step 4:** PASS, `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(odkaz-na-pc): server action žádosti o odkaz`

### Task 5: Otevření odkazu a odhlášení

**Files:**
- Create: `src/features/device-link/open.ts`, `src/features/device-link/unsubscribe.ts` (logika), `src/features/device-link/link-actions.ts` (`"use server"`: `markDeviceLinkOpened`, `unsubscribeDeviceLink`), `src/features/device-link/components/DeviceLinkOpenCapture.tsx` (client), `src/app/(public)/odhlasit/page.tsx` + `src/features/device-link/components/UnsubscribeButton.tsx`
- Modify: `src/app/(public)/layout.tsx` (vložit `<DeviceLinkOpenCapture />` vedle `AttributionCapture`), `src/features/analytics/events.ts` (události, viz Task 7)
- Test: `src/features/device-link/__tests__/open.test.ts`, `src/features/device-link/__tests__/unsubscribe.test.ts`

**Interfaces:**
- Consumes: `verifyRequestToken`, `requestTokenSecret` (Task 2), `DEVICE_LINK_MARKETING_TEXT` (Task 3).
- Produces:
  - `markOpened(token: string, device: "computer" | "phone", env: string, deps): Promise<"opened" | "already" | "phone" | "invalid">`:
    - na počítači update `opened_at = now()` jen kde `opened_at is null`;
    - na telefonu jen událost;
    - v obou případech server zapíše `device_link_open` do `learning_events` s props `{ device, env }`, bez `anon_id` a `parent_id`.
  - `unsubscribe(token: string, ctx: { ip; userAgent }, deps): Promise<"done" | "already" | "invalid">`: při `marketing_consent = true` a `unsubscribed_at is null` zapíše consent `granted false` a nastaví `marketing_consent false`, `unsubscribed_at now()`. Jinak `already`.
  - `DeviceLinkOpenCapture`: při parametru `odkaz` v URL jednou zavolá `markDeviceLinkOpened(token, device, env)` (env z `analytics/environment.ts`). Pak `odkaz` z URL odstraní přes `history.replaceState`. Klientský `track()` nevolá.
  - `captureAttribution` v `src/features/anon-session/storage.ts` vynechá `odkaz` z `landingPath`. Test v `src/features/anon-session/__tests__/` (najít existující soubor k `captureAttribution`, jinak založit).
  - `/odhlasit?t=…`: `noindex`. GET jen zobrazí text a tlačítko „Odhlásit“ (formulář s `useActionState`). Po akci ukáže „Hotovo, další e-maily už neposíláme.“ Neplatný token zobrazí „Odkaz je neplatný. Napište nám na info@weeks.cz.“

- [ ] **Step 1: Testy.** `opened_at is set once` (druhé volání → `already`, update se nevolá), `phone open does not set opened_at`, zapsaná událost nemá `anon_id`, neplatný podpis → `invalid` bez dotazu do DB, `landingPath` bez `odkaz`. `unsubscribe` zapíše přesně jeden consent řádek, druhé volání → `already`, `unsubscribe of anonymized request is a no-op`.
- [ ] **Step 2:** FAIL → **Step 3:** implementace → **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(odkaz-na-pc): otevření odkazu a odhlášení bez účtu`

### Task 6: Připomínka a anonymizace v denním cronu

**Files:**
- Create: `src/features/device-link/jobs.ts`
- Modify: `src/app/api/cron/email-sequence/route.ts`:
  - zavolat `runDeviceLinkJobs` **před** dotazem na rodiče, aby ho nepřeskočil early return „žádné dokončené účty“;
  - **obalit ho try/catch**: chyba (třeba chybějící tabulka před migrací) se zaloguje, do odpovědi jde `deviceLink: { error }` a uvítací sekvence pokračuje;
  - výsledky sloučit do JSON odpovědi, včetně `dryRun` plánu s maskovanými adresami.
- Test: `src/features/device-link/__tests__/jobs.test.ts`

**Interfaces:**
- Consumes: Task 2 (odkazy, token), Task 3 (`deviceLinkReminderEmail`, `sendTemplate` s hlavičkou).
- Produces:
  - `planDeviceLinkJobs(rows: DeviceLinkRequestRow[], registeredEmails: ReadonlySet<string>, now: Date): { remind: string[]; anonymize: string[] }`: čistá funkce podle Global Constraints. `registeredEmails` jsou lowercase.
  - `runDeviceLinkJobs(service, opts: { dryRun: boolean; now?: Date }): Promise<{ reminded: number; anonymized: number; failed: number; plan: Array<{ email: string; job: string }> }>`: nárok `update … set reminder_sent_at = now() where id = ? and reminder_sent_at is null returning id`, teprve pak odeslání. Vyhodnocuje se a posílá nejvýš 100 kusů za běh.

- [ ] **Step 1: Testy `planDeviceLinkJobs`.**
  - Bez souhlasu → ne.
  - Otevřený → ne.
  - Odhlášený → ne.
  - 47 h → ne, 49 h → ano, 8 dní → ne.
  - `skips registered email regardless of case`.
  - `reminder_sent_at` vyplněné → ne.
  - Anonymizace: 91 dní bez souhlasu → ano, 91 dní se souhlasem → ne, 91 dní odhlášený → ano, už anonymizovaný → ne.
  - Plus test na úrovni runneru: `runDeviceLinkJobs` s fake service, jejíž dotaz vrátí chybu, se v route zachytí. Logiku obalu vytáhnout do `safeRunDeviceLinkJobs(...)` v `jobs.ts`, která vrací `{ error: string }` místo výjimky.
- [ ] **Step 2:** FAIL → **Step 3:** implementace → **Step 4:** PASS. Ruční volání cronu se NEDĚLÁ (viz Global Constraints). Patří do předávacího seznamu.
- [ ] **Step 5: Commit** `feat(odkaz-na-pc): připomínka a anonymizace v denním cronu`

### Task 7: Stránka `/pro-rodice`, formulář a měření

**Files:**
- Create: `src/app/(public)/pro-rodice/page.tsx`, `src/features/device-link/components/DeviceLinkForm.tsx` (client, `useActionState(requestDeviceLink)`), `src/features/device-link/components/DeviceOrder.tsx` (client: podle `matchMedia("(pointer: coarse)")` prohodí pořadí bloků a nadpis formuláře), `public/video/ucebna-v6-9x16.mp4`, `public/video/ucebna-v6-poster.jpg`
- Modify: `src/features/analytics/events.ts` (`DEVICE_LINK_VIEW: "device_link_view"`, `DEVICE_LINK_SUBMIT: "device_link_submit"`, `DEVICE_LINK_OPEN: "device_link_open"`, `PARENT_PAGE_LESSON_CLICK: "parent_page_lesson_click"`)
- Test: `src/features/device-link/__tests__/form.test.tsx` (jsdom), `e2e/pro-rodice.spec.ts`; v `playwright.config.ts` přidat projekt `mobile` (`devices["iPhone 14"]`) pouštěný jen pro `pro-rodice.spec.ts`

**Interfaces:**
- Consumes: `requestDeviceLink` (Task 4), `fbqTrack` (`cookies/vendors.ts`), `readAnonSession` (atribuce do skrytých polí), `getCourseOutline`/`firstPlayableLesson` (odkaz „Začít první lekci“ jako na `/`).
- Produces: `DeviceLinkForm({ variant: "mobile" | "desktop" })`, znovupoužitelná komponenta pro pozdější vložení na `/`.

Obsah stránky (pořadí, texty vyká, jen fakta z Global Constraints):
1. Hero: štítek „Online učebna · děti od 9 let“, nadpis „Arduino pro vaše dítě. Zdarma, v prohlížeči.“ a jedna věta perexu.
2. Box formuláře: nadpis „Nejlíp to jde na počítači s myší. Pošleme vám odkaz.“ (desktop: „Poslat odkaz na jiný počítač“), pole e-mail, tlačítko „Poslat odkaz na počítač“, zaškrtávátko `DEVICE_LINK_MARKETING_TEXT.label` s rozbalitelným `full` a věta „E-mail použijeme k odeslání odkazu. Více v ochraně údajů.“
3. Odkaz „Přesto zkusit na telefonu →“ (desktop: hlavní tlačítko „Začít první lekci“).
4. Video (`muted playsInline loop controls preload="none" poster`).
5. Co dítě čeká (7 lekcí po 20–30 minutách, bloky i kód, certifikát).
6. Pro rodiče (zdarma, nic se neinstaluje, první lekce bez účtu, účet zakládá rodič).
7. Kdo za tím stojí (Weeks, letní tábory, odkaz na weeks.cz).

`metadata`: `robots: { index: false, follow: true }`, canonical `SITE.url + "/pro-rodice"`.

Video: `ffmpeg -i C:/Users/lukol/Downloads/ucebna-video/ucebna-v6-9x16.mp4 -vf scale=540:-2 -c:v libx264 -crf 30 -preset slow -c:a aac -b:a 64k -movflags +faststart public/video/ucebna-v6-9x16.mp4`. Cíl ≤ 3 MB, jinak zvýšit `-crf`. Plakát je snímek v 19,3 s.

`DeviceLinkForm` po připojení jednou pošle `track("device_link_view", { variant })`. Oba odkazy do lekce pošlou `track("parent_page_lesson_click", { placement: "primary" | "phone_anyway" })`. Po úspěšném odeslání klient zavolá `fbqTrack("Lead", {}, eventId)`. `eventId` vyrobí `crypto.randomUUID()` **až na klientovi po připojení** (`useEffect`), ne při renderu, aby nevznikl hydration mismatch, a pošle ho ve formuláři. `device_link_submit` zapisuje server.

- [ ] **Step 1: Testy.**
  - `form.test.tsx`: zaškrtávátko není předvyplněné, honeypot je skrytý, `variant="desktop"` má nadpis „Poslat odkaz na jiný počítač“.
  - `e2e/pro-rodice.spec.ts`:
    - `server HTML contains form and lesson link` (request bez JS: obě věci v HTML);
    - mobile projekt: formulář je nad odkazem „Přesto zkusit na telefonu“, který vede na `/kurz/iot/rozsvit-ledku/`;
    - desktop projekt: první viditelné tlačítko je „Začít první lekci“;
    - `<meta name="robots">` obsahuje `noindex`.
  - **Formulář e2e neodesílá** (smoke testy nic nezapisují).
- [ ] **Step 2:** FAIL → **Step 3:** implementace + video → **Step 4:** `npm test`, `npm run e2e -- pro-rodice` → PASS. Screenshoty 390 px a 1280 px do `docs/superpowers/mockups/2026-11-19-pro-rodice/` k posouzení textů Lukášem.
- [ ] **Step 5: Commit** `feat(odkaz-na-pc): stránka /pro-rodice s formulářem a videem`

### Task 8: Ochrana údajů a metriky

**Files:**
- Modify: `src/app/(public)/ochrana-udaju/page.tsx` (nová sekce „Odkaz na počítač“ za „Když si lekci jen zkoušíte“, doplnění „Jak dlouho údaje máme“: 90 dní / do odvolání), `src/features/metrics/queries.ts` + `docs/metriky-brana-1.sql` (řádek „Odkaz na počítač: vyžádáno / otevřeno / → registrace (`parents.utm_term in ('odkaz-na-pc','pripominka-na-pc')`)“), komponenta, která metriky vykresluje (najít přes `getMetrics`)
- Test: existující testy metrik + nový případ v `src/features/metrics/__tests__/` (pokud existují; jinak test čisté agregační funkce, kterou kvůli tomu vytáhnout)

Sekce v ochraně údajů: co (e-mail, zdroj návštěvy), proč (odeslání odkazu = žádost, čl. 6 odst. 1 písm. b; připomínka a tipy = souhlas), jak dlouho (90 dní bez souhlasu, se souhlasem do odvolání), zpracovatel Resend (už uvedený), odvolání odkazem v e-mailu nebo na info@weeks.cz. Odstavec označit v komentáři jako návrh k právníkovi.

- [ ] **Step 1:** Test agregace (`vyžádáno 3, otevřeno 1, registrace 1` z fixture) → FAIL → **Step 2:** implementace → **Step 3:** PASS.
- [ ] **Step 4: Commit** `feat(odkaz-na-pc): ochrana údajů a metriky brány 1`

### Task 9: Ověření a předání

- [ ] `npm run lint`, `npm test`, `npx tsc --noEmit`, `npm run build`: vše zelené (výstup do předání).
- [ ] agent-browser s `set device "iPhone 14"` na lokálním serveru: screenshot `/pro-rodice` mobil + desktop (jen prohlížení, nic neodesílat).
- [ ] Předávací seznam pro Lukáše (nespouštět bez něj):
  1. Spustit `015_ucebna_odkaz_na_pc.sql` v Supabase SQL editoru.
  2. Ve Vercelu nastavit `DEVICE_LINK_SECRET` (Production + Preview, např. `openssl rand -base64 32`) a ověřit `META_CAPI_ACCESS_TOKEN`.
  3. Projít texty (screenshoty v `docs/superpowers/mockups/2026-11-19-pro-rodice/`).
  3b. Po migraci (s jeho OK) ostrý průchod na jeho vlastní adresu: odeslat formulář, otevřít odkaz na PC (`opened_at`), odhlásit (consent `granted false`) a `GET /api/cron/email-sequence?dryRun=1` vrátí blok `deviceLink`.
  4. „pushni“ → merge do `main` → nasazení.
  5. V Ads Manageru nová reklama s URL `/pro-rodice?…utm_content=video-v6-reel-rodice`, stará vypnout, sadu prodloužit (s jeho OK).
