# Učebna — lobby, hlavička, oslavy a sbírka: implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dát učebně domov (lobby), jednu hlavičku s logem W, sbírku postavených obvodů, změnu avataru, oslavu po lekci a finále kurzu s 3D certifikátem.

**Architecture:** Čistá logika (stav hero, krok z konceptu, nabídka tábora, odkaz loga, validace výtvoru) žije v malých testovaných modulech bez Reactu. Komponenty jsou tenké nad nimi. Server rozhoduje o tom, co je hotové (`progress`, `projects`); prohlížeč doplňuje jen koncept a anonymní relaci. Žádná nová databázová migrace: výtvory jdou do existující tabulky `projects` přes „update, jinak insert“.

**Tech Stack:** Next.js 16 App Router (server components + server actions), React 19, Supabase (`@supabase/ssr`), Tailwind v4 tokeny z `src/app/globals.css`, Vitest (`renderToStaticMarkup` styl), Playwright smoke v `e2e/`.

**Spec:** `docs/superpowers/specs/2026-10-26-ucebna-lobby-design.md` (náhledy `docs/superpowers/mockups/2026-10-26-lobby/`). Čti oboje; plán z návrhu vychází a neopakuje ho.

## Global Constraints

- Veškerý text pro děti česky, **tykání**; rodičům vykání (jen „Účet rodiče“ a odkazy do `/ucet`).
- **Jedna amber akce na obrazovce** (`Button` variant `primary`). Všechno ostatní `outline`/`ghost`/odkaz.
- Žádná čísla lekcí napevno: „lekce N z M“, „M / M lekcí“, „po lekci M“ se odvozují z publikovaných lekcí kurzu.
- Žádná data, ceny ani počty míst tábora v učebně (§8 návrhu). Jen `CAMP_CITIES` z `src/lib/camp-offer.ts`.
- Žádná čísla, která aplikace neměří (žádný „čas u stolu“, žádný titul, žádná série dní). „Postavené obvody“ = počet hotových lekcí.
- `prefers-reduced-motion: reduce` → žádný let certifikátu, náklon, odlesk ani konfety.
- Animace jen `transform`/`opacity`. Žádná nová npm závislost bez zdůvodnění v commitu (`framer-motion` už v závislostech je).
- Gradient hero: `linear-gradient(135deg, #1e1b4b 0%, var(--color-ink) 55%, #083344 100%)` — jako utilita `bg-lobby` v `globals.css`, nepsat inline opakovaně.
- Logo W: `public/brand/weeks-w.png` (zdroj `C:/dev/weeks/weeks-web/public/images/weeks-logo.png`, 364×245).
- Neměnit `src/features/certificates/pdf.tsx` ani tvar `CertificateData`.
- Nová migrace DB se **nepřidává**.
- Commity: `git -c user.name="Lukáš Kubík" -c user.email=lukoluko8@gmail.com commit`, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Nikdy `git add -A`** — přidávat jmenovité cesty.
- Práce na větvi `feat/lobby` (z `main`). `main` = produkce; merge až po Tasku 17.
- Před každým commitem: `npx tsc --noEmit` čistý a `npx vitest run <dotčené testy>` zelené.

## Review Focus

1. **Přihlášený rodič bez aktivního profilu** (víc dětí, nebo dítě s PINem) otevře `/ucim-se/sbirka`, `/ucim-se/avatar` nebo lekci → čeká výběr profilu (redirect na `/ucim-se`), ne prázdnou sbírku ani pád. → testy v Tasku 9 a 13.
2. **Sourozenci na jednom počítači:** koncept dítěte A se nesmí ukázat v lobby dítěte B ani se mu otevřít v lekci. → test v Tasku 3.
3. **Zápis postupu poslední lekce selže nebo je pomalý:** tlačítko „Stáhnout certifikát“ nesmí vést na 404; ukáže čekání, při selhání text „Certifikát najdeš v účtu rodiče“. → test v Tasku 15.
4. **Dlouhá přezdívka** (24 znaků, diakritika, emoji, jedno slovo bez mezer) v hero, hlavičce a na certifikátu → zkrácení/zalomení bez rozbití layoutu. → testy v Tasku 11 a 12.
5. **Lekce skrytá nebo přidaná do kurzu po dokončení** (výtvor k nepublikované lekci, kurz se 7 → 8 lekcemi): mapa i sbírka ukazují jen publikované; hotový kurz se po přidání lekce vrátí do stavu „další lekce“. → test v Tasku 2.

---

### Task 1: Logo W a značka

**Files:**
- Create: `public/brand/weeks-w.png` (zkopírovat a zmenšit na výšku 96 px, PNG, průhledné pozadí)
- Modify: `src/components/ui/Logo.tsx`
- Modify: `src/app/globals.css` (utilita `bg-lobby`)
- Test: `src/components/ui/__tests__/logo.test.ts`

**Interfaces:**
- Produces: `Logo({ href?: string; dark?: boolean; mark?: boolean; className?: string })` — `mark` (výchozí `false`) přidá před „Weeks“ `<img src="/brand/weeks-w.png" alt="" width={36} height={24}>` (výška 24 px). `aria-label` zůstává „Weeks Učebna — domů“.
- Produces: CSS utilita `.bg-lobby` (gradient z Global Constraints).

- [ ] **Step 1: Test** — `logo.test.ts`: `renderToStaticMarkup(<Logo mark href="/ucim-se" />)` obsahuje `src="/brand/weeks-w.png"`, `alt=""`, `href="/ucim-se"`, text `Weeks` a `Učebna`; bez `mark` neobsahuje `weeks-w.png`.
- [ ] **Step 2:** `npx vitest run src/components/ui/__tests__/logo.test.ts` → FAIL.
- [ ] **Step 3:** Asset (zmenšit např. přes `sharp` z `node_modules` jednorázovým skriptem ve scratchpadu, ne v repu), prop `mark`, utilita `bg-lobby`.
- [ ] **Step 4:** Test → PASS; `npx tsc --noEmit` čistý.
- [ ] **Step 5:** Commit `feat(značka): logo W v hlavičce učebny`.

### Task 2: Model lobby (čistá logika)

**Files:**
- Create: `src/features/lobby/model.ts`
- Test: `src/features/lobby/__tests__/model.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type LessonStep = "brief" | "wiring" | "code";
  export interface PathLesson { slug: string; title: string; order: number; minutes: number | null; done: boolean }
  export type HeroState =
    | { kind: "start"; lesson: PathLesson }
    | { kind: "next"; lesson: PathLesson }
    | { kind: "draft"; lesson: PathLesson; step: Exclude<LessonStep, "brief"> }
    | { kind: "done" };
  export function coursePath(published: { slug: string; title: string; orderIndex: number; estimatedMinutes: number | null }[], completed: ReadonlySet<string>): PathLesson[];
  export function heroState(path: PathLesson[], draftStep: (slug: string) => LessonStep | null): HeroState;
  export function isCourseDone(publishedSlugs: readonly string[], completed: ReadonlySet<string>): boolean;
  ```
- `heroState`: kurz hotový → `done`. Jinak cíl = první nedokončená lekce v pořadí; má-li koncept (`draftStep` ≠ null a ≠ `"brief"`) → `draft`; nic hotového a bez konceptu → `start`; jinak `next`.

- [ ] **Step 1: Testy** (konkrétní případy):
  - prázdný postup, bez konceptů → `{kind:"start", lesson.slug:"rozsvit-ledku"}`;
  - hotové 1–3 → `{kind:"next", lesson.slug:"semafor"}`;
  - hotové 1–3, `draftStep("semafor") = "wiring"` → `{kind:"draft", step:"wiring"}`;
  - koncept u jiné než cílové lekce se ignoruje;
  - všech 7 hotových → `{kind:"done"}`;
  - hotových 7 ze 7, pak přidaná 8. publikovaná lekce → `next` s 8. lekcí (Review Focus 5);
  - `coursePath` řadí podle `orderIndex`, i když vstup přijde neseřazený; `isCourseDone([], …)` → `false`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementace. **Step 4:** PASS. **Step 5:** Commit `feat(lobby): model stavu lobby`.

### Task 3: Koncept podle profilu a odhad kroku

**Files:**
- Modify: `src/features/lessons/draft.ts`
- Create: `src/features/lessons/draft-step.ts`
- Modify: `src/features/lessons/components/LessonWorkbench.tsx` (prop `profileId?: string | null`, předat do load/save/clear)
- Modify: `src/features/progress/components/LessonRunner.tsx` + `src/app/(public)/kurz/[slug]/[lekce]/page.tsx` (předat `activeChild?.id ?? null`)
- Test: `src/features/lessons/__tests__/draft.test.ts`, `src/features/lessons/__tests__/draft-step.test.ts`

**Interfaces:**
- Produces (draft.ts): `draftKey(slug: string, profileId?: string | null): string` — anonym `weeks.lesson-draft.v1.<slug>` (dnešní klíč), profil `weeks.lesson-draft.v2.<profileId>.<slug>`. `loadDraft(slug, profileId?)`, `saveDraft(slug, draft, profileId?)`, `clearDraft(slug, profileId?)`.
- Migrace: `loadDraft(slug, profileId)` bez v2 záznamu, ale s v1 záznamem → přesune v1 na v2 tohoto profilu (zapíše v2, smaže v1) a vrátí ho. Jednou; druhý profil už v1 nenajde (Review Focus 2).
- Produces (draft-step.ts): `draftStep(lesson: Lesson, draft: LessonDraft | null): LessonStep | null` — `null` bez konceptu; `"code"`, když je zapojení kompletní (`wiringSteps(draft.circuit, lesson.wiring)` → `currentStep(...) === null`) a kód ≠ `lesson.starterCode` nebo bloky ≠ `lesson.blocks.starter`; jinak `"wiring"`, když se obvod liší od `lessonSeedCircuit(lesson)`; jinak `"brief"`.

- [ ] **Step 1: Testy** (jsdom pro localStorage — soubor `.test.tsx` nebo `// @vitest-environment jsdom`):
  - uložit pod profilem A → `loadDraft(slug, "B")` vrátí `null`;
  - v1 koncept + `loadDraft(slug, "A")` → vrátí koncept, v1 klíč smazaný, `loadDraft(slug, "B")` → `null`;
  - anonym čte i píše v1 klíč;
  - `draftStep`: bez konceptu → `null`; seed obvod + starter kód → `"brief"`; seed + jeden `applyStep` → `"wiring"`; `referenceCircuit(lesson.wiring)` + starter kód → `"code"` (kompletní zapojení = dítě je v kroku programu); `referenceCircuit` + `lesson.solution` → `"code"`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementace + předání `profileId` přes stránku lekce → `LessonRunner` → `LessonWorkbench`. **Step 4:** PASS + `tsc`. **Step 5:** Commit `feat(lekce): koncept podle profilu, odhad kroku`.

### Task 4: Texty lekcí pro oslavu a lobby

**Files:**
- Modify: `src/features/lessons/types.ts` (`Lesson`), `src/features/lessons/content/01…07-*.ts`
- Test: `src/features/lessons/__tests__/celebrate-copy.test.ts`

**Interfaces:**
- Produces: na `Lesson` povinné `celebrate: { title: string; line: string }` (`title` = cyan dovětek za názvem lekce, např. „jede.“; `line` = jedna věta, co dítě postavilo) a volitelné `waiting?: Partial<Record<"next" | "wiring" | "code", string>>` (dovětek do lobby). Výchozí `waiting` v `src/features/lobby/copy.ts`: `next: "je na řadě."`, `wiring: "čeká na dráty."`, `code: "čeká na program."`; funkce `waitingLine(lesson: Lesson, kind: "next" | "wiring" | "code"): string`.
- Návrhy textů (stavitel smí vylepšit, Lukáš zreviduje): 1 „svítí.“ / „Tvoje první LEDka svítí — přes rezistor, jak se patří.“; 2 „bliká.“; 3 „poslouchá.“; 4 „jede.“ / „Tři LEDky na jedné zemi, ve správném pořadí.“; 5 „se rozednívá.“; 6 „hraje.“; 7 „hlídá tmu.“.

- [ ] **Step 1: Test:** každá lekce z `LESSONS` má `celebrate.title` 2–20 znaků končící tečkou nebo vykřičníkem a `celebrate.line` 10–120 znaků; `waitingLine(lesson4, "wiring") === "čeká na dráty."`; lekce s vlastním `waiting.code` ho vrátí.
- [ ] **Step 2–4:** FAIL → texty + typy → PASS.
- [ ] **Step 5:** Commit `content(lekce): texty oslavy a lobby`.

### Task 5: Nabídka tábora jako čistá funkce + karta

**Files:**
- Modify: `src/lib/camp-offer.ts` (komentář u `CAMP_CITIES`: kdo a kdy přepíná `prihlasky`)
- Create: `src/features/camp/offer.ts`, `src/features/camp/components/CampCard.tsx`
- Modify: `src/features/onboarding/components/CampCta.tsx` — větev `segment === "camp"` vykreslí `CampCard size="card"` (jeden zdroj textu pro `/ucet`, lobby i finále, návrh §8); větev `waitlist` beze změny
- Modify: `src/features/onboarding/components/CampLink.tsx` jen pokud je potřeba nový `variant` (amber vs. textový odkaz)
- Modify: `C:/dev/weeks/weeks-web/CLAUDE.md` — sekce „When another turnus is confirmed“: přidat bod „přepni `prihlasky` v `weeks-iot/src/lib/camp-offer.ts`“ (samostatný commit v repu weeks-web, na jeho aktuální větvi nic dalšího neměnit)
- Test: `src/features/camp/__tests__/offer.test.ts`, `src/features/camp/__tests__/camp-card.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CampOffer = { kind: "open" | "soon"; city: CampCity | null } | null;
  export function campOfferFor(input: { regionCode: string | null; catchment: readonly string[]; anonymous: boolean }): CampOffer;
  export function CampCard(props: { offer: NonNullable<CampOffer>; placement: "lobby" | "finale" | "finale-anonym"; size?: "tile" | "card" }): JSX.Element;
  ```
- Pravidla `campOfferFor`: anonym → `{kind:"open", city:null}`, pokud aspoň jedno město má `prihlasky`, jinak `null`. Přihlášený: `segmentForRegion(regionCode, catchment) !== "camp"` → `null`; město `campCityForRegion` s `prihlasky` → `open`; město bez `prihlasky` → `soon`; spád bez města → `open` s `city: null`, pokud nějaké město `prihlasky` má, jinak `null`.
- `CampCard` vzhled podle náhledu (ink, W v pravém dolním rohu 25 %, štítek „Léto 2027“ v `cta-300`, nadpis „Tohle všechno naživo“, věta „Příměstský tábor {locative ?? 'v Praze a Karlových Varech'} — skutečné Arduino a 3D tisk.“; `soon` → „… připravujeme.“). Odkaz přes `CampLink` (nová karta, `camp_cta_click` s `placement`). **Bez data a ceny.**

- [ ] **Step 1: Testy** `campOfferFor`: CZ-KA → open KV; CZ-PR → soon praha; CZ-JM → null; anonym → open null; anonym, když obě `prihlasky=false` (mock přes parametr nebo `vi.mock`) → null. `CampCard` markup neobsahuje číslice kromě „2027“ a obsahuje `utm_content=lobby` pro `placement="lobby"`.
- [ ] **Step 2–4.** **Step 5:** Commit `feat(tábor): nabídka tábora pro lobby a finále` (+ samostatný commit ve weeks-web).

### Task 6: Výtvory — uložení na server

**Files:**
- Create: `src/features/collection/schema.ts`, `src/features/collection/write.ts`, `src/features/collection/actions.ts`, `src/features/collection/queries.ts`
- Modify: `src/features/lessons/components/LessonWorkbench.tsx` — `onSolved` dostane i výtvor: `onSolved(hintsUsed: number, build: LessonBuild)`
- Modify: `src/features/progress/components/LessonRunner.tsx` — po úspěšném vyřešení zavolat `saveLessonBuildAction` (jen přihlášený s profilem) a anonymně `saveAnonBuild` (Task 7)
- Test: `src/features/collection/__tests__/schema.test.ts`, `src/features/collection/__tests__/write.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // schema.ts
  export interface LessonBuild { courseSlug: string; lessonSlug: string; circuit: Circuit; code: string; blocks?: WorkspaceState; mode: "blocks" | "code" }
  export const lessonBuildSchema: z.ZodType<LessonBuild>; // comps ≤ 80, wires ≤ 300, code ≤ 20 000 znaků, JSON celkem ≤ 100 kB, slugy jako anonLessonSchema
  // write.ts (server-only)
  export async function writeLessonBuild(childId: string, build: LessonBuild): Promise<boolean>; // lesson_id ze slugů přes service client; UPDATE projects WHERE child_id, lesson_id, kind='circuit'; když 0 řádků → INSERT; title = název lekce
  // actions.ts
  export async function saveLessonBuildAction(input: unknown): Promise<{ ok: boolean }>; // jako saveLessonProgressAction: childId jen z getActiveChild, nikdy z klienta
  // queries.ts (server-only)
  export interface SavedBuild { lessonSlug: string; title: string; data: LessonBuild; updatedAt: string }
  export async function childBuilds(childId: string, courseSlug: string): Promise<Map<string, SavedBuild>>;
  ```
- Tvar `data` v `projects`: `{ v: 1, circuit, code, blocks?, mode }` (verze kvůli budoucí změně).

- [ ] **Step 1: Testy:** schéma odmítne 81 součástek, kód 20 001 znaků, slug s velkými písmeny, chybějící `circuit.wires`; přijme `referenceCircuit(lesson7.wiring)` + `lesson7.solution`. `write.test.ts` s mockovaným service klientem (vzor `vi.mock("@/lib/supabase/server")` jako v `progress/__tests__`): existující řádek → volá `update`, ne `insert`; žádný → `insert` s `kind:"circuit"`, `title`.
- [ ] **Step 2–4.** Ověřit, že `onSolved` dostává aktuální `circuit`, `source` (kód/vygenerovaný kód), `blocks`, `mode` **před** `clearDraft`.
- [ ] **Step 5:** Commit `feat(sbírka): ukládání postavených obvodů`.

### Task 7: Výtvory — anonym a převzetí

**Files:**
- Create: `src/features/collection/anon-builds.ts` (klient)
- Modify: `src/features/anon-session/actions.ts` (`adoptAnonProgressAction`), onboarding převzetí (místo, kde se volá `writeLessonProgress` při registraci — dohledat v `src/features/onboarding/actions.ts`), `src/features/anon-session/components/*` (formulář posílá i výtvory)
- Test: `src/features/collection/__tests__/anon-builds.test.ts`

**Interfaces:**
- Produces: `ANON_BUILDS_KEY = "ucebna.anon-builds.v1"`; `saveAnonBuild(build: LessonBuild): void` (jeden na lekci, přepis), `readAnonBuilds(): LessonBuild[]` (neplatné položky zahodit přes `lessonBuildSchema`), `clearAnonBuilds(): void`. Samostatný klíč — `anonSessionSchema` se **nemění** (zůstává v1).
- Převzetí: akce přijme pole `anonBuilds` (JSON, ≤ 8 položek, každá přes `lessonBuildSchema`) a po úspěšném zápisu postupu zavolá `writeLessonBuild` pro každou; selhání výtvorů převzetí postupu **neshodí** (jen `console.warn`). `clearAnonBuilds` se volá tam, kde se dnes volá `clearAnonSession`.

- [ ] **Step 1: Testy:** dvakrát uložená lekce = 1 položka (poslední); poškozený JSON v klíči → `[]` a nic nespadne; neplatná položka se vynechá, platná zůstane.
- [ ] **Step 2–4.** **Step 5:** Commit `feat(sbírka): výtvory bez účtu a jejich převzetí`.

### Task 8: Hlavička aplikace, menu pod avatarem, odkaz loga

**Files:**
- Create: `src/features/shell/home-href.ts`, `src/features/shell/components/AppHeader.tsx` (server), `src/features/shell/components/AvatarMenu.tsx` (klient), `src/features/shell/queries.ts`
- Create: `src/app/(child)/layout.tsx` (AppHeader)
- Modify: `src/app/(public)/layout.tsx` + `src/components/ui/PublicChrome.tsx` (session-aware pravá strana a logo), `src/app/(child)/ucim-se/page.tsx` a `prepnout/page.tsx` (odstranit vlastní hlavičky), `src/app/(parent)/layout.tsx` (odkaz „Do učebny →“ na `/ucim-se`)
- Test: `src/features/shell/__tests__/home-href.test.ts`, `src/features/shell/__tests__/app-header.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Viewer = { kind: "anon"; hasProgress?: boolean } | { kind: "parent" } | { kind: "child"; nick: string; avatar: string };
  export function homeHref(viewer: Viewer): string; // child|parent → "/ucim-se"; anon s postupem → "/kurz/iot"; anon → "/"
  export async function getViewer(): Promise<Viewer>; // server: getUser + getActiveChild; anon.hasProgress server nezná (undefined)
  export function AppHeader(props: { viewer: Viewer; tone?: "dark" | "light"; inLesson?: boolean }): JSX.Element;
  export function AvatarMenu(props: { nick: string; avatar: string }): JSX.Element;
  ```
- Anonym: logo vede na `/`; klientská komponenta `AnonHomeLink` po připojení přepíše `href` na `/kurz/iot`, má-li `hasCompletedAnyLesson(readAnonSession())`.
- Navigace dítěte: Domů `/ucim-se` · Kurzy `/kurz/iot` · Sbírka `/ucim-se/sbirka`; aktivní podle `usePathname` (malá klientská `NavLinks`). Na < 640 px navigace jen v `AvatarMenu`.
- `AvatarMenu`: tlačítko `aria-haspopup="menu"`, `aria-expanded`; položky „Změnit avatar“ `/ucim-se/avatar`, „Přepnout profil“ `/ucim-se/prepnout`, „Účet rodiče“ `/ucet`, „Odhlásit“ (existující odhlašovací akce z parent layoutu — vytáhnout do sdílené `signOutAction`, pokud je inline). Esc zavře a vrátí fokus; klik mimo zavře.
- Lekce dál ukazuje pruh „Učí se {nick} · Přepnout“ a drobečkovou navigaci, jejíž cíl je `homeHref(viewer)` místo `/kurz/{slug}` pro přihlášené (anonym zůstává `/kurz/{slug}`).

- [ ] **Step 1: Testy:** `homeHref` 4 případy; `AppHeader` markup: anonym obsahuje „Přihlásit“ a ne „Sbírka“; parent obsahuje „Vybrat profil“ a „Účet rodiče“; child obsahuje „Sbírka“, nick a `href="/ucim-se"` u loga; v lekci (`inLesson`) anonym nemá „Zkusit zdarma“.
- [ ] **Step 2–4.** Ruční kontrola: klávesnicí otevřít/zavřít menu.
- [ ] **Step 5:** Commit `feat(hlavička): jedna hlavička s logem a menu pod avatarem`.

### Task 9: Změna avataru

**Files:**
- Create: `src/app/(child)/ucim-se/avatar/page.tsx`, `src/features/children/components/AvatarPicker.tsx` (klient)
- Modify: `src/features/children/actions.ts` (nová akce)
- Test: `src/features/children/__tests__/avatar-action.test.ts`

**Interfaces:**
- Produces: `setActiveChildAvatarAction(_prev: ActionState, formData: FormData): Promise<ActionState>` — `avatar` musí být id z `AVATARS` (pomocná `isAvatarId(value: unknown): value is AvatarId` v `avatars.tsx`); profil **jen** z `getActiveChild(user.id)` (žádné `childId` z klienta); zápis běžným klientem (RLS `children_update_own`); `revalidatePath("/ucim-se")`, pak `redirect("/ucim-se")`.
- Stránka: bez aktivního profilu `redirect("/ucim-se")` (Review Focus 1); mřížka 8 avatarů (`AVATARS`), aktuální vyznačený `aria-pressed`, každý avatar je `<button type="submit" name="avatar" value=…>` ve formuláři; nadpis „Vyber si avatar“; odkaz „Zpět do lobby“.
- V hero lobby se avatar kreslí na světlém kruhu uvnitř cyan prstence (návrh §10), ne přímo na gradient.

- [ ] **Step 1: Testy:** `isAvatarId("raketa")` true, `"fox"` false, `null` false; akce s neplatným avatarem vrátí `{ error }` a nevolá `update` (mock supabase); bez aktivního profilu vrátí `{ error }`.
- [ ] **Step 2–4.** **Step 5:** Commit `feat(profil): dítě si mění avatar`.

### Task 10: Náhled obvodu

**Files:**
- Create: `src/features/collection/components/CircuitThumb.tsx` (klient)
- Test: ruční (vizuální) + `src/features/collection/__tests__/circuit-thumb.test.ts` (jen markup placeholderu)

**Interfaces:**
- Produces: `CircuitThumb({ circuit: Circuit; label: string; height?: number; litState?: boolean })` — vykreslí `CircuitBuilder` `readOnly` až ve chvíli, kdy je v zorném poli (`IntersectionObserver`), do té doby tmavý placeholder stejné velikosti s `aria-label={label}`. `litState` = pustit jeden běh `runProgram` se vzorovými vstupy a ukázat první snímek s rozsvícenou LED (volitelné, jen pokud nezdrží > 50 ms; jinak bez).
- Výkon: na stránce sbírky se 7 náhledy žádný long task > 200 ms (ověřit v Chrome Performance nebo Playwright `page.evaluate` s `PerformanceObserver`).

- [ ] **Step 1–4:** test placeholderu; implementace; ruční ověření výkonu.
- [ ] **Step 5:** Commit `feat(sbírka): náhled obvodu`.

### Task 11: Certifikát ve 3D

**Files:**
- Create: `src/features/certificates/components/CertificateStage.tsx` (klient), `src/features/certificates/components/CertificateFace.tsx` (čisté HTML líce, sdílené s `CertificateTile`)
- Modify: `src/features/certificates/components/CertificateCard.tsx` — zmenšenina přejde na `CertificateFace`
- Test: `src/features/certificates/__tests__/certificate-face.test.ts`

**Interfaces:**
- Produces: `CertificateFace({ data: CertificateData | null; placeholderName?: string; lessons: number; compact?: boolean })` — `data === null` → jméno `placeholderName ?? "Tvoje jméno"` vybledlé (anonym, návrh §6.4); pečeť „{lessons} / {lessons} lekcí“. `CertificateStage({ face: ReactNode; onLanded?: () => void })` — přílet, náklon, odlesk, pohupování, reduced motion podle návrhu §6.3 (hodnoty: přílet z `translateY(60px) rotateX(40deg) rotateY(-30deg) scale(.7)` do `rotateX(6deg) rotateY(-12deg)` za 1,1 s s přestřelem; náklon ±11° X, ±13° Y, scale 1.03; pohupování ±3°, perioda 6 s; `translateZ` text 30 px, pečeť 50 px). Interpolace v `requestAnimationFrame` (lerp 0.15), ne přímé nastavení z `mousemove`. `pointerType === "touch"` → pohupování místo náklonu.
- Líce: `aria-hidden`; jméno `break-words`, max 2 řádky, `font-size` se zmenší pro > 14 znaků (Review Focus 4).

- [ ] **Step 1: Testy:** `CertificateFace` s `data` obsahuje jméno, název kurzu, projekt, „Weeks s.r.o.“, datum ve formátu `formatCertificateDate`; s `null` obsahuje „Tvoje jméno“; 24znaková přezdívka dostane menší třídu písma.
- [ ] **Step 2–4.** Ruční kontrola: plynulost na 60 fps, `prefers-reduced-motion` v DevTools → statický.
- [ ] **Step 5:** Commit `feat(certifikát): 3D certifikát`.

### Task 12: Lobby

**Files:**
- Create: `src/features/lobby/queries.ts` (server), `src/features/lobby/components/LobbyHero.tsx`, `LobbyHeroDraft.tsx` (klient), `CoursePath.tsx`, `LobbyBottom.tsx`, `BuildsTile.tsx`, `CertificateTile.tsx` (líc z Tasku 11)
- Modify: `src/app/(child)/ucim-se/page.tsx` (přepis větve s aktivním profilem; výběr profilu a `ZapsatLekci` zůstávají)
- Test: `src/features/lobby/__tests__/lobby.test.ts`

**Interfaces:**
- Consumes: `coursePath`, `heroState`, `isCourseDone` (Task 2), `draftStep`, `loadDraft` (Task 3), `waitingLine` (Task 4), `campOfferFor`, `CampCard` (Task 5), `childBuilds` (Task 6), `earnedCertificates` (existující), `CircuitThumb` (Task 10).
- Produces: `getLobbyData(child: ChildSummary, parentId: string): Promise<LobbyData>` s `{ course: {slug,title}, path: PathLesson[], builds: Map<string, SavedBuild>, certificate: EarnedCertificate | null, camp: CampOffer, stats: { lessons: number; builds: number; certificates: number } }`; `LobbyHero({ data, nick, avatar })` vykreslí serverový `heroState(path, () => null)` a `LobbyHeroDraft` ho po připojení přepočítá s `draftStep(lesson, loadDraft(slug, childId))`, **bez změny výšky** karty.
- Tlačítko hero: `start` „Začít první lekcí →“, `next` „Pokračovat v lekci →“, `draft` „Pokračovat, kde jsi skončil →“ s `href` `/kurz/iot/{slug}?pokracovat=1`, `done` „Prohlédnout certifikát →“ → `/ucim-se/sbirka`.
- Hero nadpis: `start` „Ahoj {nick}. / Postavíme první *obvod?*“; `next`/`draft` „Vítej zpátky. / {lekce} *{waitingLine}*“; `done` „Kurz {název} máš *hotový.*“. Přezdívka v avataru sloupci `truncate`, v nadpisu `break-words` (Review Focus 4).
- `CoursePath` podle náhledu: uzly jako `Link`, svisle pod `sm`. `LobbyBottom`: grid `md:grid-cols-3`, sekce stejné výšky (`h-full`, společná `min-h`), třetí sekce bez tábora → grid na dvě sekce.

- [ ] **Step 1: Testy** (`renderToStaticMarkup` s fixturami, `CircuitThumb` mockovaný): 4 stavy hero → správný text tlačítka a `href`; mapa: 7 uzlů, právě jeden s „právě tady“, hotové mají `aria-label` „hotovo“; spodní řada bez tábora má 2 sekce; přezdívka „Maximiliánekxxxxxxxxxxxx“ (24 znaků) je v markupu jednou s třídou `truncate`.
- [ ] **Step 2–4.** Ruční kontrola 1366×768 a 390×844: „Pokračovat“ nad ohybem.
- [ ] **Step 5:** Commit `feat(lobby): domov dítěte`.

### Task 13: Sbírka a detail výtvoru

**Files:**
- Create: `src/app/(child)/ucim-se/sbirka/page.tsx`, `src/app/(child)/ucim-se/sbirka/[lekce]/page.tsx`, `src/features/collection/components/BuildCard.tsx`
- Test: `src/features/collection/__tests__/collection-page.test.ts`

**Interfaces:**
- Consumes: `childBuilds`, `earnedCertificates`, `getCourseOutline`, `CircuitThumb`, `CertificateTile`.
- Bez aktivního profilu → `redirect("/ucim-se")` (Review Focus 1).
- Mřížka v pořadí lekcí, jen **hotové publikované** lekce; bez uloženého výtvoru → `referenceCircuit(lesson.wiring)` + štítek „vzorové zapojení“ (návrh §9.3). Detail: velký `CircuitThumb`, program jen ke čtení (`CodeView` z `lessons/components/CodeEditor.tsx`, u bloků `BlockEditor` readOnly, pokud ho umí — jinak vygenerovaný kód), tlačítko amber „Otevřít lekci znovu“. Detail lekce bez výtvoru: obvod vzorový, místo programu věta „Tuhle lekci jsi dokončil dřív, než jsme začali ukládat výtvory. Otevři ji znovu a tvoje verze se sem uloží.“ Detail nehotové nebo neexistující lekce → `notFound()`.

- [ ] **Step 1: Testy:** pomocná `collectionItems(path, builds)` (do `collection/queries.ts`) — 3 hotové, 1 s výtvorem → 3 položky, 2 s `reference: true`; nepublikovaná lekce s výtvorem se nevrátí.
- [ ] **Step 2–4.** **Step 5:** Commit `feat(sbírka): stránka sbírky a detail výtvoru`.

### Task 14: Malá oslava po lekci a „pokračovat od kroku“

**Files:**
- Create: `src/features/celebrate/components/LessonDone.tsx`, `src/features/celebrate/components/MiniPath.tsx`
- Modify: `src/features/progress/components/LessonRunner.tsx` (větev `completed` pro nefinální lekce), `src/features/lessons/components/LessonWorkbench.tsx` (`?pokracovat=1` → po načtení konceptu rovnou krok z `draftStep`), `src/features/lessons/components/Celebration.tsx` (prop `palette?: "weeks"` s barvami `#fbbf24 #22d3ee #67e8f9 #4f46e5 #10b981 #fafaf7`)
- Test: `src/features/celebrate/__tests__/lesson-done.test.ts`

**Interfaces:**
- Consumes: `coursePath`, `isCourseDone` (Task 2), `Lesson.celebrate` (Task 4).
- Produces: `LessonDone({ lesson: Lesson; path: PathLesson[]; next: PathLesson | null; viewer: "child" | "parent-no-profile" | "anon"; savedToCollection: boolean; zapsatHref?: string })`.
- Rozhodnutí finále vs. malá oslava: `isCourseDone(publishedSlugs, allDone)` (stejná sada jako `course_complete`), **ne** `nextLessonSlug === null`. Kdo dokončí poslední lekci bez ostatních, dostane `LessonDone` a v něm „Zbývá ti {n} lekcí do certifikátu.“ s odkazem na první nedokončenou.
- Anonym: pravá půlka = dnešní zeď „Ulož si to“ (text beze změny) + sekundární „Další lekce →“. `parent-no-profile`: dnešní `Alert` s `?zapsat=` nad kartou další lekce.
- „Přidáno do tvé sbírky.“ jen když `savedToCollection` (výsledek `saveLessonBuildAction` nebo anonymní uložení).

- [ ] **Step 1: Testy:** markup pro lekci 4 obsahuje „Semafor“, „jede.“, „Další lekce“ (amber jen jednou — počet `bg-cta-500` = 1), „Do lobby“ s `href="/ucim-se"`; anonym obsahuje „Uložit můj postup“ a „Další lekce“; poslední lekce s chybějícími 2 → „Zbývá ti 2 lekce“.
- [ ] **Step 2–4.** **Step 5:** Commit `feat(oslava): oslava po lekci`.

### Task 15: Finále kurzu (přihlášený i anonym)

**Files:**
- Create: `src/features/celebrate/components/CourseFinale.tsx`
- Modify: `src/features/progress/components/LessonRunner.tsx` (finální větev; `CourseEndWall` odstranit), `src/app/(public)/kurz/[slug]/[lekce]/page.tsx` (předat `courseTitle`, `certificateContent` z `CERTIFICATES`, `campOffer`, `childId`, `nick`)
- Test: `src/features/celebrate/__tests__/course-finale.test.ts`

**Interfaces:**
- Consumes: `CertificateStage`, `CertificateFace` (Task 11), `CampCard` (Task 5), `CircuitThumb` (Task 10).
- Produces: `CourseFinale({ mode: "child" | "anon"; nick: string | null; childId: string | null; courseSlug: string; courseTitle: string; projectTitle: string; lessons: number; camp: CampOffer; progressSaved: Promise<boolean> | boolean })`.
- Nadpis bez 5. pádu (návrh §11): přihlášený „{nick} je *konstruktér.*“ (nick `break-words`), anonym „Kurz máš *za sebou.*“.
- „Stáhnout certifikát ↓“ (amber): `href = /ucet/certifikat/{childId}/{courseSlug}/`, `target="_blank"`. Dokud `progressSaved` nedoběhne → tlačítko `loading` s textem „Chystám certifikát…“; `false` → místo tlačítka věta „Certifikát najdeš v účtu rodiče, jakmile se postup uloží.“ a „Zpět do lobby“ se stane amber (Review Focus 3). `progressSaved` = promise z `saveLessonProgressAction` v `handleSolved` (uložit do `useRef`/state).
- Anonym: `CertificateFace` s `data=null`; amber „Ulož si postup a získej certifikát“ → `/registrace` (`signup_start` s `course`, `after_lesson`, `order` jako dnešní `CourseEndWall`); sekundárně „Zpět na přehled kurzu“ `/kurz/{slug}`; karta „Co dál“ s dnešním textem o prohlížeči.
- Konfety: `Celebration` při zobrazení a znovu v `onLanded`.

- [ ] **Step 1: Testy:** child: obsahuje nick, `href="/ucet/certifikat/<id>/iot/"`, „Zpět do lobby“, `utm_content=finale`; `progressSaved=false` → neobsahuje `/ucet/certifikat/`, obsahuje „v účtu rodiče“; anon: „Tvoje jméno“, `/registrace`, `utm_content=finale-anonym`, žádný odkaz `/ucet/certifikat`.
- [ ] **Step 2–4.** **Step 5:** Commit `feat(oslava): finále kurzu s certifikátem`.

### Task 16: Lobby bez účtu na přehledu kurzu

**Files:**
- Create: `src/features/lobby/components/AnonLobby.tsx` (klient)
- Modify: `src/app/(public)/kurz/[slug]/page.tsx`
- Test: `src/features/lobby/__tests__/anon-lobby.test.ts`

**Interfaces:**
- Consumes: `coursePath`, `heroState`, `draftStep`, `loadDraft(slug, null)`, `LobbyHero` vizuál (sdílet prezentační část — `LobbyHeroView` bez dotazů), `CoursePath`, `CampCard`, `readAnonSession`.
- Pro přihlášeného s profilem se `/kurz/[slug]` nemění kromě hlavičky (lobby má `/ucim-se`). Pro anonyma: server vykreslí dnešní stránku; `AnonLobby` po připojení, má-li `hasCompletedAnyLesson`, nahradí horní sekci hero lobby (bez avataru a čísel) a pod ni vloží `CoursePath`; spodní řada = karta „Ulož si postup“ (amber jen pokud hero nemá amber — hero má, takže „Ulož si postup“ jako `outline`) + `CampCard`.
- Pozn.: `CourseOutlineList` dnes slévá anonymní relaci i pro přihlášené (sourozenci) — pro přihlášené s profilem slévání vypnout (prop `mergeAnon={!viewer || viewer.kind === "anon"}`).

- [ ] **Step 1: Testy:** pomocná `anonLobbyModel(outline, session, draftLookup)` vrací `null` bez hotové lekce, jinak `{hero, path}`; přihlášený nezapočítá anonymní relaci.
- [ ] **Step 2–4.** **Step 5:** Commit `feat(lobby): lobby pro dítě bez účtu`.

### Task 17: Ověření, recenze, nasazení

**Files:**
- Create: `e2e/lobby.spec.ts`
- Modify: `e2e/smoke.spec.ts` jen pokud se změnil text, na který smoke test čeká

- [ ] **Step 1:** `e2e/lobby.spec.ts` (bez přihlášení, proti `npx next dev`): anonym otevře `/kurz/iot/rozsvit-ledku`, vyřeší lekci (vzor `zapoj za mě` + „Ukázat řešení“ + „Vložit do editoru“ + Spustit, jako ve skriptech z 25.–26. 10.), „Mám hotovo“ → vidí „svítí.“ a „Další lekce“; klik na logo → `/kurz/iot` s hero „Pokračovat“; `/ucim-se` → redirect na přihlášení.
- [ ] **Step 2:** `npx tsc --noEmit`, `npx vitest run` (vše), `npx next build`, `npx playwright test e2e/smoke.spec.ts e2e/lobby.spec.ts` → zelené.
- [ ] **Step 3:** Ruční průchod v Chromu (1366×768, 390×844, reduced motion): lobby 4 stavy (fixture profil v DB — **nevytvářet** reálné účty; použít Lukášův účet až s jeho souhlasem, jinak jen anonymní cesty + komponentní testy), malá oslava, finále anonymně, menu klávesnicí.
- [ ] **Step 4:** Celá větev projde recenzí (fresh reviewer, `superpowers:requesting-code-review`), nálezy opravit.
- [ ] **Step 5:** Push `feat/lobby` → Vercel preview; Lukáš projde preview přihlášený (lobby, sbírka, avatar, finále). Po jeho OK merge do `main` (fast-forward), push, ověřit produkci za ~75 s.
