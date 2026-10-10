<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Weeks Učebna

Výuková platforma pro děti od 9 let na `ucebna.weeks.cz`. Není to samostatný
byznys — je to trychtýř na letní tábory Weeks, který si na sebe vydělá
předplatným.

**Uživatel je dítě, plátce je rodič.** Platební zeď proto nikdy nestojí mezi
dítětem a obsahem. Stojí mezi rodičem a důkazem.

Rozhodovací dokumenty nejsou v repozitáři — leží jako `.docx`
v `C:\Users\lukol\Downloads\` s prefixem `Weeks - `. Návrh a plán aktuálního
přepisu jsou v `docs/superpowers/`.

## Dvě aplikace v jednom repozitáři

| | Kde | Stav |
|---|---|---|
| Nová učebna | `src/app/(public\|auth\|parent\|child)/`, `src/features/`, `src/lib/` | vyvíjí se |
| Táborový kiosek | `src/legacy/`, routa `/tabor` | **zamrazený** |

`src/legacy/` je port táborového kiosku a přepisuje se, ne opravuje. Sahej do
něj jen tehdy, když měníš táborový režim. Používá alias `@legacy/*`; nová
aplikace `@/*`.

## Struktura nové aplikace

Vertikální řezy podle domény, ne vrstvy. Každý řez v `src/features/<název>/`
drží `schema.ts` (Zod), `actions.ts` (`"use server"`), `queries.ts`,
`components/` a `__tests__/`.

Důvod: audit vytýkal `page.tsx` na 2 300 řádcích. Soubor, který se nevejde do
hlavy, se nevejde ani do kontextu.

## Pravidla, která se v tomhle projektu porušují nejsnáz

**Zápis jen přes Server Actions se Zod validací.** Klient nikdy neposílá ID,
která si může vymyslet — slugy se překládají na ID na serveru.

**Bezpečnostní hranicí je grant v databázi, ne kód.** `pin_hash` a sloupce
rozhodující o předplatném nemá role `authenticated` v grantu. Když přidáváš
tabulku, přidej i RLS politiku a sloupcové granty do migrace.

**Souhlasy jsou append-only.** Odvolání je nový řádek s `granted = false`,
nikdy update. Kdo mění znění v `src/features/consent/texts.ts`, MUSÍ zvýšit
`version` — jinak vzniknou dva různé souhlasy pod stejným označením.
Smazání účtu ledger nemaže: `consents.parent_id` se odpojí (`on delete set
null`, migrace 013) a řádek zůstane jako doklad. Záznam souhlasu zákonného
zástupce se váže na dítě (`consents.child_id`, migrace 014).

**Anonymní relace nesmí nic poslat na server.** Do okamžiku, kdy rodič odešle
registraci, žije postup výhradně v `localStorage`. Je to právní stav, ne
optimalizace. Přihlášený rodič, který
se vrátí na stejný počítač, dostane na `/ucet` NABÍDKU převzetí (`AdoptProgressPrompt`);
nikdy k tomu nedojde automaticky. „Ne“ postup smaže z prohlížeče.

**Rozdělaný onboarding je v sessionStorage, bez souhlasů.** `onboarding/draft.ts`
drží datum, přezdívku, avatar a kraj. Souhlasy se neukládají nikdy — ani jako
předvyplněné, ani po obnovení. Koncept se maže až na `/ucet?vitejte=1`, tedy po
úspěšném zápisu účtu.

Hlavička lekce ukazuje, kdo se učí (`activeChild`: přezdívka, avatar), a odkaz
„Přepnout“ vede na `/ucim-se/prepnout`. Přihlášený rodič bez vybraného profilu
hlavičku nevidí a postup se nezapisuje (`needsChildProfile`).

**Anonym měří stejně jako přihlášený.** Bez `lesson_start` od anonyma
neexistuje jmenovatel hlavní metriky a brána 1 se nedá vyhodnotit.

**Odemykání obsahu za hvězdičky se nezavádí.** Je to překážka postavená přímo
do metriky, kterou maximalizujeme.

## Pasti, které tenhle projekt už jednou stály čas

- **Řádky databáze musí být `type`, ne `interface`.** Interface nemá implicitní
  index signature, neprojde `Record<string, unknown>` uvnitř `GenericSchema`
  a supabase-js pak vyhodnotí všechny tabulky jako `never`. Projeví se to jako
  „not assignable to parameter of type never" u každého `.insert()`.
- **`"use server"` soubor smí exportovat jen async funkce.** Konstanty a typy
  patří vedle, jinak spadne build.
- **Čisté pomocné funkce nepatří vedle přístupu k databázi.** Klientská
  komponenta si jedním importem přitáhne serverový Supabase klient do
  prohlížeče. `src/lib/supabase/server.ts` má proto `server-only`.
- **React 19 přesunul `JSX` namespace do modulu `react`.** Augmentace přes
  `declare global { namespace JSX }` se tiše ignoruje.
- **Řídicí znaky v regexu piš jako `\x00`, ne doslovně.** Doslovné jsou
  neviditelné a při normalizaci se tiše ztratí.
- **Tailwind v4 nemá `tailwind.config.ts`.** Konfigurace žije inline
  v `src/app/globals.css` pod `@theme`.

## Emulátor a lekce

Kurz stojí na třech vrstvách, které o sobě vědí co nejmíň:

1. **Obvod** (`src/features/circuit/`) — sítě, cesty, kontrola zapojení,
   simulace. Neví nic o lekcích ani o Arduinu jako jazyce.
2. **Arduino** (`src/features/arduino/`) — lexer, parser, interpret, deska.
   Neví nic o obvodu; mluví s ním přes rozhraní `Board`.
3. **Lekce** (`src/features/lessons/`) — obsah, kontroly, průchod. Jediné
   místo, kde se ty dvě vrstvy potkávají, je `simulate.ts`.

**Kontroluje se chování, ne text kódu.** Program se doopravdy spustí nad
obvodem, který dítě postavilo, a ptáme se, CO DĚLÁ. Původní kontrola
porovnávala kód se vzorem a u nočního světla vyžadovala proměnnou pojmenovanou
přesně `svetlo`; kdo napsal `hodnota`, dostal chybu za funkční program.

**Databáze drží osnovu, kód drží obsah.** Lekce obsahuje funkce (`verify`
u kontrol) a ty se přes hranici server → klient nepřenesou. Že se ty dva
zdroje nerozejdou, hlídá `src/features/lessons/__tests__/seed.test.ts`, který
čte migraci jako text. **Přidáváš lekci? Přidej i migraci** — jinak spadne test.

**Lekce se přejímá testem, ne pohledem.** `lessons.test.ts` postaví ze zadání
skutečný obvod a pustí na něm vzorové řešení. Chytá to překlepy v pinech,
kontroly, které vzorové řešení neprojde, a startovní kód, co se nepřeloží.

### Pasti přímo v téhle vrstvě

- **`findPath({ through })` je seznam POVOLENÝCH typů, ne vyžadovaných.**
  „Vede tam cesta a je na ní rezistor?" se ptá `result.through.includes(...)`.
  Bez toho svítila LED zapojená napřímo — přesně ta chyba, kterou lekce 1 učí.
- **Snímek obvodu se pořizuje na ZAČÁTKU každé pauzy, před `delay()`.**
  Stav, který na pinech platí, drží celou pauzu, takže snímek se razí před
  posunem času a nese svou délku (`durationMs`). Dřív se razil po posunu
  a „HIGH 500 ms, LOW 10 ms" se ukázalo obráceně. Přehrávání jde 1 : 1
  (`playbackSchedule` v `useFramePlayer.ts`); stav kratší než jeden tick
  mezi dlouhými se natáhne na tick, aby nezmizel.
  Sériový výpis nevyrábí nové snímky: připojí se k poslednímu. Běh končí
  limitem 60 s virtuálního času nebo 4000 snímků (`RunLimitSignal`).
- **Kontroly poznávají součástky podle ROLE, ne podle pořadí.** Pořadí v obvodu
  je pořadí, v jakém je dítě položilo. Role dává `checkWiring(...).roles`.
- **`useFramePlayer` porovnává reference snímků.** Nové pole při každém renderu
  (`x ?? []`) ho zacyklí; na prázdný stav je `NO_FRAMES`.
- **Sítě součástky nespojují.** Rezistor ani LED nejsou vodič — spojení skrz ně
  řeší `paths.ts`, protože u nich záleží na tom, že tam jsou. Napětí se proto
  musí propagovat zvlášť (`conductivePairs` v `simulate.ts`).
- **Ikony v `public/cad/palette/` jsou prázdné 1×1 pixely.** Paleta místo nich
  kreslí skutečnou Wokwi součástku. Nespoléhej na `spec.paletteIcon`.
- **Prohlížeč pošle po každém tahu ještě `click`.** Bez měření vzdálenosti
  gesta začne posun součástky zároveň kreslit drátek.
- **Zapíchnutí do breadboardu spojuje podle POLOHY.** Piny na téže souřadnici
  jsou jedna síť, když je jedna strana deska (`breadboardContacts` v
  `nets.ts`). Testy proto nesmí skládat součástky na (0,0) — propojí se.
- **`NetVoltage.isGround` počítá stisk tlačítka.** Nestisknuté tlačítko
  svoje poloviny nespojuje, takže LED za ním ani bzučák nedostanou zem —
  stejně jako na desce. Čtení vstupů i `isGround` sdílí `groundedNets`.
  Rezistor a potenciometr zemi vedou vždycky.
- **Náhled běhu je vlastní běh, ne snímky z první kontroly.** Kontroly si
  vstupy nastavují samy, takže by v lekci o tlačítku svítila LED bez stisku.
- **Skutečné pozice nožiček dává `element.pinInfo` Wokwi prvků.** Piny ve
  spec stojí na mřížce a kresba se přisouvá přes `visualOffset` (změřeno
  z pinInfo). Kdo mění `scale`, musí offset přepočítat. Wokwi LED má anodu
  VPRAVO (A=x25, C=x15).
- **Přímý spoj v zadání znamená nula součástek po cestě** (`maxHops:
  through?.length ?? 0`). S `+1` prošla „zem" protažená skrz samotné
  tlačítko — a stisk pak nic neměnil.
- **LED s rezistorem je `series`, ne dva `connections`.** Rezistor smí být na
  kterékoli straně LED. Pár spojů s `through` na anodě by katodovou variantu
  odmítl. `resolveConnections` vybere stranu podle toho, kde rezistor už
  stojí; průvodce i `referenceCircuit(spec, side)` jedou stejnou variantou.
  Lekce 3 a 6 zatím mají spoje ručně (jejich zadání se nesmí měnit).
- **Pin řídí obvod jen jako výstup.** `digitalWrite` bez `pinMode(OUTPUT)`
  zapíše do stavu desky, ale do drátu nejde. `analogWrite` a `tone` přepnou
  pin na výstup samy. Zápis bez režimu a `analogWrite` na pinu bez PWM
  (mimo 3, 5, 6, 9, 10, 11) jdou do `diagnostics` s větou pro kód i bloky.
- **Zkrat se počítá z drátů, ne přes součástky.** 5 V přímo na zemi se
  pozná před během; výstup HIGH přímo na zemi nebo LOW přímo na 5 V
  zastaví běh. LED s rezistorem mezi tím zkrat není; vstup s tlačítkem k zemi
  taky ne.
- **Analogový pin čte senzor přes obvod.** Fotorezistor dává hodnotu z
  `inputs.analog` (slider), jen když je napájený z 5 V a má zem. Nenapájený
  čte jako tmu. Kontrola to ověřuje přes `sensors` podle role, ne přes
  `pinInputs`.
- **Kontroly tlačítkových lekcí mačkají roli (`pressed`), ne pin.** Vnucený
  `pinInputs` pustí i obvod s trvale uzemněným pinem.
- **Editor musí barvit komentáře.** Dokud byl text jednobarevný, dítě napsalo
  příkaz do řádku, který už `//` měl, a nemělo jak poznat, že jeho program je
  prázdný. Barevný `<pre>` leží pod průhlednou `textarea` — obě vrstvy musí mít
  stejné písmo, prokládání i odsazení a synchronizované rolování v OBOU osách.
- **Přeložený program, který nic nedělá, je třetí stav.** Není to chyba
  překladu ani nesplněná kontrola. `silentProgramReason` ho pojmenuje a
  `run-check` se na něj ptá jen tehdy, když neprošla ANI JEDNA kontrola —
  jinak by ukazoval na komentář, co si dítě schovalo stranou schválně.
- **Z každého kroku musí vést cesta ven.** Nápovědy dojdou a „Napsat program"
  se objeví teprve, když zapojení sedí — bez únikové cesty tam lekce končí.
  Po poslední nápovědě proto přibude „Zapoj tenhle krok za mě" (`applyStep`)
  a „Ukázat řešení". Počítá se do `hintsUsed` jednou za krok, ne za kliknutí.
- **`CircuitBuilder` si obvod drží sám** — `initialCircuit` je opravdu jen
  počáteční hodnota. Dovnitř se obvod dostane jedině přes `pushCircuit`, které
  porovnává REFERENCI, takže každé vnucení musí být nový objekt.

### Deska, tlačítko a obsazenost (builder)

- **Tlačítko je čtyřnožičkový spínač 6×6 mm, ne Wokwi tlačítko.** Nožičky
  `1a/1b` a `2a/2b` jsou uvnitř spojené vždycky (strana 1, strana 2), stisk
  spojí `1a` s `2a`. Na desce leží přes prostřední drážku: strana 1 v jednom
  sloupci (řady E a F), strana 2 ve druhém. Pár přes příkop je jediná cesta
  mezi půlkami, takže přes příkop se nic jiného nespojí. Otočené o 90° na jedné
  polovině dá obě strany do stejného sloupce → breadboard je zkratuje a tlačítko
  je pořád stisknuté. Hlídá to `wiring-steps.ts` (varování).
- **Kontroly berou kteroukoli nožičku strany** (`equivalentPins`). Přesný pin
  by dítě zbytečně trestal za to, která nožička je nahoře.
- **Polohu pinu počítá jen `pins.ts`** (`resolvePinPosition`, `toPlane`).
  Otočení je rotace kolem středu obdélníku a kresba dostává CSS transformaci
  `rotationTransform`. Obě věci se musí shodovat — test porovnává CSS
  s maticí. Kdo počítá `x + dx·PITCH` přímo, rozjede nožičku od kresby.
- **Obsazenost je jedna věc: `occupancy.ts`.** Dírka nebo pin Arduina patří
  jedné nožičce, nebo jednomu konci drátku. Reducer odmítne drátek i položení
  do obsazené dírky, otočení i přesun, které by dvě věci dalo do jedné.
  Zelené kroužky se kreslí podle `pluggedLegs`.
- **Klik: `targetAt` v tomhle pořadí** — nožička (do 18 px), tělo součástky,
  drátek (do 8 px), deska, prázdno. Dírka pod tělem nebo pod nožičkou není
  cíl (kresba ji zakrývá). Volná dírka vyhraje, jen když je blíž než nožička.
- **Vrstvy:** deska a Arduino 1 → drátky 5 → součástky 6 → kroužky 12 →
  náhled 13. LED se nesmí schovat za drátek ani za desku.
- **Přesun desky nese zapíchnuté díly** (`carry`, `pluggedInto` v okamžiku
  tahu). Deska se posouvá po celém kroku mřížky, takže díly zůstanou v dírkách.
- **Výřez:** `RESET` zachová zoom a posun. Krok „Zapoj za mě" výřez nepřepočítá,
  jen posune, když nová součástka leží mimo něj. Obsah drží `clampPan` aspoň
  60 px na obrazovce, zoom kolečkem jde ke kurzoru (`zoomAt`).
- **Zapoj za mě** bere jen volné piny Arduina (`wiresFor` / `freeHoleInColumn`).
  Referenční zapojení rozděluje tři GND piny. Test `trench.test.ts` projde
  všechny lekce a hlídá zkrat.

## Bloky

Krok Program má přepínač **Bloky | Kód**; výchozí jsou bloky (mladší děti
zastaví syntaxe dřív, než pochopí, co program dělá).

- **Bloky nemají vlastní pravdu.** `features/blocks/program.ts` je čistá
  funkce: JSON stavu Blockly → Arduino C. Ten jde do stejné `runLessonChecks`
  jako kód psaný rukou. Blockly samo je jen editor a načítá se líně
  (`BlockEditor`), jen v režimu bloků.
- **Žádné proměnné.** Piny se píšou číslem do bloku, smyčka má blok
  „hodnota z opakování", senzor se čte tam, kde je potřeba. Proměnná
  s překlepem nebo háčkem by skončila chybou překladu, kterou v blocích
  nejde najít.
- **Paleta se odvozuje z řešení lekce** (`paletteFor`). Nový blok v řešení
  = nový blok v nabídce; nic se neudržuje ručně.
- **Nápovědy v blocích nesmí diktovat kód.** Lekce má `blocks.hints`
  a kontroly, jejichž `hint` jmenuje příkaz, mají `blockHint`. Hlídá to
  `blocks/__tests__/program.test.ts` — spolu s tím, že řešení z bloků
  každé lekce projde kontrolami.
- **Přidáváš lekci?** Přidej i `blocks` (výchozí, řešení, nápovědy).
- **Mění se text bloku** (`definitions.ts`)? Přepiš i nápovědy, které ho
  citují v uvozovkách.
- **Ikony Blockly jsou v `public/blockly/`.** Výchozí CDN CSP nepustí.
- Kód → bloky neumí převést zpátky: přepínač se zeptá, když dítě kód
  upravilo, a jeho úpravy pak zahodí.

## Přihlášení Googlem

- Tlačítko je Google Identity Services (`GoogleSignIn`), účet se ukáže s názvem
  učebny, ne s adresou `supabase.co`. ID token jde do `signInWithIdToken`,
  pak `completeGoogleSignInAction` rozhodne cíl přes `afterSignInPath`.
- Nonce: Google dostává HASH (`hashNonce`), Supabase SUROVÝ. Záměna = chyba
  při každém přihlášení.
- Bez `NEXT_PUBLIC_GOOGLE_CLIENT_ID` nebo bez skriptu Googlu (blokátor) zůstává
  přesměrovací tok (`GoogleButton`). `NEXT_PUBLIC_*` se zapéká při buildu —
  změna na Vercelu platí až po novém deployi.
- CSP pro GIS je v `next.config.ts` (`GOOGLE_IDENTITY`).

## Design

Maker lab — technický výkres, ne dětská grafika. Portováno z
`weeks_web@design/maker-lab`. Bricolage Grotesque na nadpisy, Instrument Sans
na text, IBM Plex Mono na čísla a technická metadata. Tvrdé stíny místo
měkkých, `rounded-md` místo `rounded-2xl`.

Dvě hlasitosti, jeden systém: dětská zóna vzdušná a barevná, rodičovská zóna
a auth kompaktní a střízlivá. Rodič tam dává souhlas a platí kartou.

Amber je vyhrazená hlavní akci. Dvě amber tlačítka na jedné obrazovce znamenají,
že jedno z nich je špatně.

Mobile-first od 320 px. Dotykové cíle minimálně 44 px.

## Měření, cookies a tábor

- **Cookies a měřicí skripty jsou za souhlasem.** Lišta je
  `src/features/cookies/CookieBanner.tsx`, souhlas žije jen v `localStorage`
  (`ucebna-cookie-consent`, verze `COOKIE_CONSENT_VERSION` — bump = nový dotaz).
  GA4 (`NEXT_PUBLIC_GA_ID`) se načte po analytickém souhlasu, Meta Pixel
  (`NEXT_PUBLIC_FB_PIXEL_ID`) po marketingovém. Bez env proměnné se nenačte nic.
- **Pixel ne na dětské obrazovky.** `pixelAllowedFor` vylučuje `/ucim-se*`
  a lekce `/kurz/<kurz>/<lekce>`. GA běží všude po souhlasu. Kdo přidá novou
  dětskou routu, přidá ji i tam.
- **Do GA jde jen whitelist** (`GA_PARAMS` v `vendors.ts`) a jen funnel
  události. Zápis do našeho Supabase se nemění — `track()` pošle vždy jako dřív.
- **Server-side Meta CAPI** (`CompleteRegistration` v `onboarding/actions.ts`)
  se posílá JEN s marketingovým souhlasem z onboardingu (`marketing-v3`).
- **`/tabor` je vypnutý.** Routa vrací 404, pokud není `TABOR_ENABLED=1`.
  PINy nemají výchozí hodnoty: prázdný PIN nikdy nepustí dovnitř
  (`verifyPin`), kiosek se bez env PINů nedá odemknout.
- **E2E smoke test** (`npm run e2e`, Playwright). Čte, nezakládá účty. Lokálně
  spustí `npm run dev`; proti běžícímu serveru `BASE_URL=... npm run e2e`.

## Před commitem

```bash
npx tsc --noEmit    # musí být čistý pro nový kód
npm test            # 684 testů
npm run build       # odhalí úniky server→klient, které tsc nevidí
```

`npm run lint` hlásí chyby i v `src/legacy/` — ty jsou známé a zamrazené.
V novém kódu musí být lint čistý.
