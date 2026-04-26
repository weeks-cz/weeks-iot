# Weeks IoT (v2)

Výuková IoT platforma pro děti z Weeks táborů. 21 úkolů s Arduinem ve třech obtížnostech (začátečník, pokročilý, expert), sbírání hvězdiček, témata, avatary a odměnový systém.

## 1. Co to je

- **Stack:** Next.js 16 (App Router), React 19, TypeScript 5 (`strict`), Tailwind CSS v4, Framer Motion, Lucide React.
- **Provoz:** běží jako Next.js aplikace na Vercelu. Endpoint `/api/notify-account` je serverless funkce (odesílá potvrzovací e-maily přes Resend).
- **Stav dat:** progres dítěte se ukládá do `localStorage` pod klíčem `iot-camp-screen-state-v6`. **Žádné migrace** — když bumpujeme verzi storage, stará data se prostě smažou.
- **Jazyk:** všechen obsah je česky včetně diakritiky.

## 2. Proč se to změnilo

Z původní vanilla JS aplikace (v `legacy-vanilla/`) jsme přešli na Next.js kvůli typovému systému, komponentám a serverovému endpointu pro e-maily — vanilla verze byla dál neudržitelná.

## 3. První nastavení

Uděláš jednou.

1. **Node.js 20+** — https://nodejs.org (LTS), klikej Next.
2. **Git pro Windows** — https://git-scm.com/download/win, nech default.
3. **VS Code** — https://code.visualstudio.com.
4. **Codex CLI** — `npm install -g @openai/codex` (potřebuje Node 20+). Přihlas se: `codex login`.
5. **Naklonuj projekt:**
   ```bash
   git clone https://github.com/lxkask/weeks-iot.git
   cd weeks-iot
   npm install
   ```
6. **Zkopíruj env soubor:**
   ```bash
   cp .env.local.example .env.local
   ```
   Pro lokální dev můžeš nechat `RESEND_API_KEY` prázdný — jen e-maily se neodešlou. Reálný klíč mám já (Lukáš), nikdy ho nedávej do repa.
7. **Spusť dev server:**
   ```bash
   npm run dev
   ```
   Otevře se na http://localhost:3000.
8. **Branch:** vždycky pracuj na `dev`, nikdy ne na `main`.
   ```bash
   git checkout dev
   ```

Hotovo.

## 4. Jak pracovat s Codexem

Tohle je hlavní část. Codex CLI je nástroj, který upraví kód podle prompty. Trik je dát mu **přesné cesty k souborům**, jinak hádá a dělá nepořádek.

### Workflow v krocích

1. Stáhni nejnovější verzi: `git pull`
2. Spusť Codex v rootu projektu: `codex`
3. Napiš prompt (šablony níže). Codex navrhne změny, schvaluješ je nebo upravuješ.
4. **Po každé sérii změn** projdi [post-Codex checklist](#post-codex-checklist).
5. Commit + push na `dev`. Vercel postaví preview během ~30 s.
6. Klikni preview link na stránce commitů, ručně proklikej, jestli to nedělá nepořádek.

### Prompt šablona 1 — Přidat nový Arduino úkol

Úkoly jsou rozdělené do sekcí podle obtížnosti. Sekce udržují konzistentní `reward: 5`. Pokud chceš úkol s validací kódu, musíš dotknout taky `strict-rules.ts` nebo `task-solutions.ts`.

```
Přidej nový úkol "Blikání dvěma LED" do sekce "Pokročilý" v src/lib/tasks.ts.

- ID úkolu: blink-two-leds
- Obtížnost: pokročilý
- Reward: 5 hvězdiček (jako ostatní v té sekci)
- Popis: česky, vysvětluje že má student rozblikat dvě LED střídavě
- Image: public/task-images/blink-two-leds.png (obrázek dodám sám)
- Validace: přidej granulární pravidla do src/lib/strict-rules.ts
  (musí obsahovat pinMode pro 2 piny, 2x digitalWrite, delay)
- Pokud potřeba, přidej referenční řešení do src/lib/task-solutions.ts

Po úpravě zkontroluj, že všechny TypeScript typy sedí (src/types/index.ts).
```

Cesty k souborům, které Codex (skoro vždy) musí dotknout:
- `src/lib/tasks.ts` — přidat objekt do pole `SECTIONS`.
- `src/lib/strict-rules.ts` — granulární pravidla (volitelně).
- `src/lib/task-solutions.ts` — bulk validátor / referenční řešení (volitelně).
- `public/task-images/<id>.png` — obrázek schématu, ručně tam dej PNG ≤ ~200 KB.

### Prompt šablona 2 — Opravit text v popisu úkolu

```
V src/lib/tasks.ts najdi úkol s ID "led-basic" a v poli description
oprav překlep: "rozsvit" → "rozsviť" (s diakritikou).
Nech vše ostatní beze změny.
```

Tip: pokud nevíš ID, otevři `src/lib/tasks.ts` a vygrep si tam část původního textu.

### Prompt šablona 3 — Přidat nové téma (theme)

Téma jsou barevné varianty (světlé/tmavé/akcentové). Themes jsou propojené přes 3 soubory + CSS:

```
Přidej nové téma "ocean" (modrá akcentová) do projektu.

1. src/lib/themes.ts — přidej ThemeOption se všemi metadaty.
2. src/types/index.ts — rozšiř type ThemeId o "ocean".
   Pokud chceš nový accent (např. "azure"), rozšiř i ThemeAccent.
3. src/app/globals.css — přidej blok [data-theme="ocean"] { ... }
   se VŠEMI 20 CSS proměnnými. Vzor zkopíruj z existujícího tématu.

Dodrž stávající strukturu, neměň nic jiného.
```

Poznámka: Tailwind v4 v tomhle projektu **NEPOUŽÍVÁ** `tailwind.config.ts`. Konfig je inline v `src/app/globals.css` přes `@theme inline`. Codex si to občas plete — pokud začne navrhovat tailwind.config.ts, zastav ho.

### Prompt šablona 4 — Povolit nový topic

Topic = velká kategorie (IoT, Python, Web…). Aktuálně má reálný obsah jen `iot`.

```
V src/lib/topics.ts přepni "enabled: false" na "enabled: true"
u topicu s ID "python".

POZOR: nezapomeň, že topic musí mít vlastní úkoly / themes / avatars,
jinak bude jen prázdná dlaždice. Pokud obsah nemáme, nedělej nic.
```

### Post-Codex checklist

Tohle pusť **vždycky**, než commitneš. V tomhle pořadí:

1. **TypeScript:**
   ```bash
   npx tsc --noEmit
   ```
   Musí vrátit 0 chyb. Pokud chyba, hoď výstup zpět Codexu: "Oprav tyhle TS errory: …"
2. **Build:**
   ```bash
   npm run build
   ```
   Catches problémy, které `tsc` nezachytí (Next.js, React Server Components, importy obrázků).
3. **Klikání:**
   ```bash
   npm run dev
   ```
   Otevři http://localhost:3000 a ručně projdi to, co jsi měnil. Nový úkol → klikni na něj. Nové téma → přepni v Style Shopu.
4. **Commit** (conventional commit prefix):
   ```bash
   git add -A
   git commit -m "feat(tasks): add blink-two-leds task"
   ```
   Prefixy: `feat(...)` nová funkce, `fix(...)` oprava, `docs:` dokumentace, `chore(...)` údržba.
5. **Push na dev** (NIKDY přímo na main):
   ```bash
   git push
   ```
6. **Preview link:** otevři https://github.com/lxkask/weeks-iot/commits/dev → u svého commitu klikni zelenou fajfku → najdi řádek `Vercel – Preview` → `Details`.

## 5. Kam se koukat na preview + produkci

- **Preview (každý push na `dev`):** `https://weeks-iot-git-dev-<team>.vercel.app` — link najdeš v GitHubu u commitu (viz krok 6 výše). URL je stabilní, můžeš si ji uložit.
- **Produkce:** `https://iot.weeks.cz` (případně `https://weeks-iot.vercel.app`, pokud custom doména ještě není napojená). Aktualizuje se **jen při mergi do `main`** — to dělám já (Lukáš) přes pull request.

Workflow do produkce: `dev` → otevřu PR → review → merge do `main` → ~30 s a je to nahoře.

## 6. Lokální dev

- Start: `npm run dev` → http://localhost:3000.
- Build (jen ověření, že to projde): `npm run build`.
- Lint: `npm run lint`.
- TypeScript check (rychlejší než full build): `npx tsc --noEmit`.

**Env proměnné** (`.env.local`, viz `.env.local.example`):
- `RESEND_API_KEY` — pro `/api/notify-account`. Lokálně může být prázdný.
- `ACCOUNT_EMAIL_FROM` — odesílatel potvrzovacích e-mailů.
- `NEXT_PUBLIC_TEST_MODE` — když `1`, nové účty dostanou testovací zůstatek hvězdiček. V produkci nech prázdné.

**Časté gotchas:**
- Změna v `.env.local` vyžaduje restart `npm run dev` (Ctrl+C a znovu).
- Po `git pull` zkus `npm install` (mohly přibýt deps).
- Po změně `iot-camp-screen-state-v6` klíče v kódu smaž localStorage v DevTools.
- Turbopack je v Next 16 default a občas drží stale cache — pomáhá `rm -rf .next`.

## 7. Co když něco pokazím

Klid. Na `dev` produkci nerozbiješ. Postup od nejméně po nejvíc destruktivní:

```bash
# Co jsem vlastně změnil?
git status
git diff

# Vrátit změny v jednom souboru (ještě před commitem):
git checkout -- src/lib/tasks.ts

# Odložit rozdělanou práci stranou (vrátíš se k ní později):
git stash
# ... později:
git stash pop

# DESTRUKTIVNÍ: zahodit všechny lokální změny a srovnat se s remote dev.
# Použij JEN když víš, že o nic nepřijdeš.
git reset --hard origin/dev
```

**Pokud jsi pushnul rozbitý kód na `dev`:** nepanikař a **nedělej force-push**. Buď udělej revert commit (`git revert <sha>` a push), nebo otevři fix branch a pushni opravu normálně. Když nevíš, napiš mi.

## 8. Co NEDÁVAT do repa

Tyhle věci `.gitignore` už řeší, ale ať víš:

- `.env.local` — obsahuje reálný `RESEND_API_KEY`. **Nikdy** to nesmí do gitu.
- `node_modules/`, `.next/`, `out/` — generované soubory, váží stovky MB.
- `.vscode/settings.json`, `.idea/` — IDE configy jsou osobní.
- Tajné klíče, hesla, API tokeny v kódu — ani jako "dočasně".
- Velké binárky — task images / avatars by měly být PNG ≤ ~200 KB. Cokoli většího se mě zeptej.
- Osobní data dětí — platforma má fungovat bez nich (jen lokální progress v prohlížeči).

## 9. CLI reference (cheatsheet)

### Git

```bash
git status                       # co se změnilo
git diff                         # ukaž změny řádek po řádku
git pull                         # stáhni nejnovější verzi
git checkout dev                 # přepni na dev branch
git checkout -- <soubor>         # zahoď změny v jednom souboru
git add <soubor>                 # připrav soubor ke commitu
git add -A                       # připrav vše
git commit -m "feat(x): popis"   # commit
git push                         # pošli na GitHub
git stash                        # odlož rozdělanou práci
git stash pop                    # vrať odloženou práci
git log --oneline -10            # posledních 10 commitů
git reset --hard origin/dev      # DESTRUKTIVNÍ: zahodit vše lokální
```

### npm / Next.js

```bash
npm install                      # nainstaluj dependencies
npm run dev                      # dev server na :3000
npm run build                    # produkční build (ověření)
npm run lint                     # ESLint
npx tsc --noEmit                 # rychlá TypeScript kontrola
```

### Codex CLI

```bash
codex                            # spusť interaktivně v rootu projektu
codex login                      # přihlášení (jen jednou)
```

Když si nejsi jistý, **zeptej se** (Lukáš) než zkusíš naslepo. Lepší 5 min konverzace než hodina hledání, co se stalo.
