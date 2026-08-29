# Učebna v2 — samoobslužná registrace a onboarding

**Fáze 1, Task 1.** Návrh k implementaci. 29. srpna 2026.

| | |
|---|---|
| Na co navazuje | Brána 0 prošla. Audit fáze 0, Shrnutí a rozhodnutí (13. 8.), „Co uvnitř bude" (27. 8.), odsouhlasení modulů na callu 28. 8. |
| Co tenhle dokument řeší | Architekturu nového jádra učebny a kompletní tok od anonymní návštěvy po funkční rodičovský účet s profily dětí. |
| Co neřeší | Obsah lekcí, circuit builder, 3D studio, platby, certifikát, měsíční report. Ty mají vlastní bloky. |

---

## 1. Rozsah

Task 1 zní „samoobslužná registrace a onboarding" se třemi podúkoly: registrace zvenčí bez lektora, onboarding s krajem a věkem, souhlas rodiče. Rozsah je ale širší — patří k němu všechno kolem přihlašování a architektura, na které to stojí, protože dnešní aplikace je port táborového kiosku a nemá kam registraci pověsit.

**V rozsahu:**

- Nová struktura repozitáře, routování a design systém
- Nový datový model (Supabase projekt od nuly) s RLS a sloupcovými granty
- Anonymní relace a její bezeztrátový přenos do účtu
- Registrace rodiče: heslo, magic link, Google
- Onboarding: kraj, přezdívka a rok narození dítěte, souhlasy
- Souhlas zákonného zástupce jako verzovaný append-only ledger
- Profily dětí, PIN jako přepínač profilu
- Rodičovská zóna: přehled, správa dětí, odvolání souhlasu, smazání účtu
- Transakční e-maily přes Supabase Auth Hook → Resend
- Události měření, které brána 1 potřebuje
- Kostra veřejných rout kurzu a lekce s placeholder obsahem

**Mimo rozsah** (má vlastní blok): obsah lekce 1 a video, oprava 55 typových chyb v CAD, kontrola zapojení, platby živě, certifikát, měsíční report, dashboard.

## 2. Rozhodnutí, ze kterých návrh vychází

| # | Rozhodnutí | Zdroj |
|---|---|---|
| R1 | Účet zakládá rodič, dítě má pod ním profil | Brána 0, bod 10 |
| R2 | Zeď přichází až po dokončené první lekci | Audit 4.2 |
| R3 | Do zdi neodchází na server žádný osobní údaj | Audit 4.2 |
| R4 | Ukládá se rok narození, ne datum | Audit 4.3 |
| R5 | Souhlas oddělený od obchodních sdělení, nic předvyplněné | Audit 4.3 |
| R6 | Odvolání souhlasu stejně snadné jako udělení | Audit 4.3 |
| R7 | Postup jsou řádky, ne JSONB blob | Audit 4.8 |
| R8 | PIN je přepínač profilu, ne přístupová brána | Audit 4.1 |
| R9 | Odemykání za hvězdičky se ruší | Audit 4.5 |
| R10 | Nová větev, staré do `src/legacy/`, nový Supabase projekt | Lukáš, 29. 8. |
| R11 | Heslo + magic link + Google | Lukáš, 29. 8. |
| R12 | Spád tábora: Praha, Středočeský, Karlovarský — konfigurací v DB | Lukáš, 29. 8. |
| R13 | Design maker-lab z větve `weeks_web@design/maker-lab`, dvě hlasitosti | Lukáš, 29. 8. |
| R14 | E-maily přes Supabase Auth Hook → vlastní route → Resend | Lukáš, 29. 8. |

## 3. Architektura

### 3.1 Repozitář

Větev `feat/ucebna-v2`. Dnešní kód se stěhuje do `src/legacy/` a zamrazuje; nová aplikace se staví vedle a z legacy přebírá hotové vrstvy teprve tehdy, kdy je potřebuje. `main` zůstává nasazený a nedotčený.

```
src/
  app/
    (public)/         /, /kurz/[slug], /kurz/[slug]/[lekce]      indexovat
    (auth)/           /registrace, /prihlaseni, /obnova-hesla    noindex
    (parent)/ucet/    přehled, děti, souhlasy, smazání účtu      noindex
    (child)/ucim-se/  dětská zóna po volbě profilu               noindex
    tabor/            legacy kiosek, beze změny chování          noindex
    api/              auth hook pro e-maily
    auth/callback/    OAuth + magic link + potvrzení adresy
  features/           vertikální řezy domény
    anon-session/     lokální relace, migrace do účtu
    auth/             registrace, přihlášení, obnova
    consent/          znění, verze, ledger, odvolání
    children/         profily, PIN
    onboarding/       kraj, dítě, souhlasy
    progress/         zápis a čtení postupu
    analytics/        události, UTM
  lib/                supabase, db, email, regions, rate-limit, security
  components/ui/      design systém maker-lab
  legacy/             zamrazený dnešní kód
```

Vertikální řezy schválně. Audit vytýká `page.tsx` na 2 300 řádcích a obrazovky bez hranic. Každý řez drží vlastní schéma, server actions, komponenty a testy — vejde se do hlavy člověku i do kontextu modelu, a jde ho změnit, aniž se rozbije soused.

Každý řez má stejný tvar:

```
features/<řez>/
  schema.ts      Zod — jediný zdroj pravdy o tvaru vstupu
  actions.ts     "use server" — jediné místo, kde se zapisuje
  queries.ts     čtení
  components/    UI
  __tests__/
```

### 3.2 Routování a SEO

Dnešní stav je nález N2: celá aplikace běží na jedné adrese a kořenový layout má plošné `noindex`. Tím zmizí i indexovatelnost veřejné části, na které stojí akvizice.

| Adresa | Obsah | Robots |
|---|---|---|
| `/` | vstupní stránka učebny | index |
| `/kurz/[slug]` | přehled kurzu s ukázkou výsledku | index |
| `/kurz/[slug]/[lekce]` | jedna lekce | index jen u pořadí 1 |
| `/registrace`, `/prihlaseni`, `/obnova-hesla` | auth | noindex |
| `/ucet/**` | rodičovská zóna | noindex |
| `/ucim-se/**` | dětská zóna | noindex |
| `/tabor/**` | táborový kiosek | noindex |

Rozhodnutí padá pro každou routu zvlášť v jejím `metadata`, ne plošně v kořeni.

## 4. Datový model

Nový Supabase projekt. Produkční data se podle auditu nemigrují — jsou to jednotky účtů.

### 4.1 Tabulky

```
regions            kód kraje (CZ-PR…), název, is_camp_catchment
parents            id→auth.users, email, region_code, utm_*, created_at
consents           parent_id, kind, version, text_snapshot, granted, ip, ua, created_at
children           id, parent_id, nick, birth_year, avatar, pin_hash, archived_at
courses            id, slug, title, summary, order_index, is_published
lessons            id, course_id, slug, title, order_index, body, is_published
progress           child_id, lesson_id, status, started_at, completed_at, duration_s
projects           id, child_id, lesson_id, data jsonb, thumbnail
learning_events    id, parent_id, child_id, anon_id, type, props jsonb, created_at
city_waitlist      id, parent_id, city, region_code, created_at
```

Dvě věci stojí za vysvětlení.

**`progress` jsou řádky, ne blob.** Dnešek drží celý stav v `learning_accounts.state` jako JSONB. Nález N6 říká proč to nejde: hlavní metrika brány 1 — „kolik procent z těch, kdo začali, dokončí" — se z blobu nedá spočítat dotazem. Řádek na dvojici (dítě, lekce) se `started_at` a `completed_at` je přesně ten tvar, na který jde položit `count(*) filter (where completed_at is not null)`. JSONB zůstává jen u `projects.data`, kde je tvar opravdu volný.

**`consents` je append-only ledger.** Souhlas jako sloupec na řádku rodiče nejde: odvolání by ten záznam přepsalo a důkaz o tom, co člověk odsouhlasil, by zmizel. GDPR přitom po správci chce prokázat *co přesně* a *kdy*. Ledger drží každý úkon jako nový řádek s `granted true/false` a se snapshotem plného znění; „má platný souhlas?" je dotaz na poslední řádek daného druhu. Řádky se nikdy neupravují ani nemažou — vynutí to RLS a chybějící `update`/`delete` grant.

### 4.2 Bezpečnostní model

RLS je zapnuté na všem a výchozí odpověď je zákaz. Klient nikdy nezapíše nic, co rozhoduje o penězích nebo přístupu — to je vzorec, který audit chválí u migrace 002 a který se sem přenáší.

| Tabulka | Rodič (`authenticated`) | Poznámka |
|---|---|---|
| `parents` | select/update vlastní řádek, jen povolené sloupce | `plan`, `plan_expires_at` píše výhradně servisní role |
| `consents` | select vlastní, **insert jen přes RPC** | žádný update, žádný delete — ani vlastníkovi |
| `children` | plný přístup k vlastním dětem | `pin_hash` klient nečte ani nepíše |
| `progress`, `projects` | přes vlastnictví dítěte | zápis validovaný server actions |
| `learning_events` | insert-only, bez čtení | zachováno z dneška |
| `courses`, `lessons`, `regions` | select publikovaných | veřejné, i pro anonymní |
| `city_waitlist` | insert, select vlastní | |

Vlastnictví dítěte se ověřuje funkcí `public.owns_child(uuid)` označenou `security definer` se `search_path` přibitým na `public` — bez toho jde politika obejít podvržením schématu.

`pin_hash` je z klientských grantů vyloučený sloupcovým grantem. Ověření PINu tedy nemůže proběhnout v prohlížeči ani omylem.

## 5. Toky

### 5.1 Anonymní vstup a přenos do účtu

Kroky M2 z dokumentu. Klíčová vlastnost: **do kroku 4 neodchází na server žádný osobní údaj.**

| Krok | Co se děje | Kde žije stav | Událost |
|---|---|---|---|
| 1 | Veřejná stránka kurzu | UTM do `localStorage` | `visit_first` |
| 2 | „Zkusit zdarma" → lekce běží bez účtu | `localStorage` | `lesson_start` |
| 3 | Dítě lekci dokončí, vidí výsledek | `localStorage` | `lesson_complete` |
| 4 | Zeď: „Ulož si to" | — | `signup_prompt_view` |
| 5 | Rodič vyplní e-mail, kraj, dítě, souhlasy | server | `signup_parent` |
| 6 | Anonymní postup se přenese do účtu | server | — |

Anonymní relace je objekt v `localStorage` pod `ucebna.anon.v1`: náhodné `anonId` (jen pro spárování událostí), zachycené UTM, a pole dokončených lekcí s časy. Žádné jméno, žádný e-mail, žádný rok narození — ty se ptáme až v kroku 5.

Přenos v kroku 6 je Server Action `adoptAnonymousSession`. Vstup projde Zod schématem, lekce se přemapují ze slugů na `lesson_id` (klient si nesmí vymyslet ID), a zápis je **idempotentní** přes `on conflict (child_id, lesson_id) do update` — dvojí odeslání nesmí zdvojit postup ani vyrobit druhou sérii dnů. Časy z prohlížeče se přijímají, ale ořezávají na rozumné okno; `completed_at` v budoucnosti nebo před vznikem účtu se zahodí a nahradí časem serveru.

Relace se z `localStorage` maže až po potvrzeném zápisu, ne před ním.

### 5.2 Registrace a onboarding

Jeden wizard, čtyři kroky, jedna URL s krokem ve stavu — ne čtyři stránky, aby zpětné tlačítko nevyhazovalo z formuláře.

1. **E-mail a způsob přihlášení.** Heslo, magic link, nebo Google. Při hesle se kontroluje délka (min. 10 znaků) a shoda proti seznamu nejčastějších hesel — ne skladba znaků, ta jen tlačí lidi k `Heslo123!`.
2. **Kraj.** Výběr ze 14 krajů. Řídí, jestli rodič uvidí kartu letního termínu, nebo čekačku na město.
3. **Dítě.** Přezdívka a rok narození. Volitelně avatar a PIN.
4. **Souhlasy.** Dva nezávislé boxy, ani jeden předvyplněný, plus potvrzení podmínek.

Až po odeslání celého wizardu vzniká účet. Nedokončený onboarding tedy nenechává v databázi poloviční řádky.

**Ověření adresy.** Rodič dostane potvrzovací e-mail. Účet funguje i před potvrzením, ale nepotvrzený se po 7 dnech smaže cronem a v rodičovské zóně visí upozornění. Je to zároveň to „přiměřené úsilí k ověření věku", které § 7 po správci chce: v kombinaci s výslovným prohlášením zákonného zástupce a záznamem IP je to standard, který se dá doložit.

### 5.3 Profily dětí a PIN

PIN mění roli — z přístupové brány se stává přepínačem profilu pro rodinu se dvěma dětmi na jednom počítači. Tři úrovně PINů se zálohami `123`, `2468` a `321` v klientském stavu mizí úplně.

Z toho plyne, jak se má chovat:

- PIN je **volitelný**. Bez něj se profil přepne kliknutím.
- Hash je scrypt (`node:crypto`, N=16384, r=8, p=1), sůl na záznam, uložený v `children.pin_hash`.
- Ověření dělá výhradně Server Action, s limitem 5 pokusů za 15 minut na dítě. Po vyčerpání se profil zamkne a odemkne ho rodič ze své zóny.
- Porovnání je `timingSafeEqual`.
- PIN **není bezpečnostní hranice** — je to zábrana proti sourozenci, ne proti útočníkovi. Přesto nesmí být divadlo: hash na serveru stojí pár řádků a chrání i před tím, že si ho někdo přečte v bundlu.

### 5.4 Odvolání souhlasu a smazání účtu

Odvolání musí být stejně snadné jako udělení — jedno tlačítko v `/ucet/souhlasy`. Zapíše nový řádek do ledgeru s `granted = false`.

Odvolání **souhlasu zákonného zástupce** má důsledek: bez něj nemá zpracování údajů dítěte právní základ. Tlačítko proto říká pravdu — „odvolání znamená smazání profilů dětí" — a spustí stejnou cestu jako smazání účtu, s potvrzením a sedmidenní lhůtou na rozmyšlenou. Odvolání **obchodních sdělení** je nezávislé a nemá žádný jiný následek.

Smazání účtu maže kaskádou rodiče, děti, postup, projekty **i ledger souhlasů**. Ledger tedy smazání nepřežije, a je to tak správně: držet záznamy o souhlasu navázané na člověka, jehož ostatní údaje jsme na žádost smazali, by znamenalo uchovávat osobní údaje bez právního základu. Prokazovat souhlas ke zpracování, které už neexistuje, po správci nikdo chtít nemůže.

Zůstává jediná stopa — řádek v `learning_events` s typem `account_deleted`. Ten má na `parent_id` vazbu `on delete set null`, takže po smazání nese jen informaci „někdy toho dne byl na žádost smazán účet", bez vazby na osobu.

## 6. Souhlas zákonného zástupce

Znění píšu jako verzi `parental-v1`, uloženou v kódu a nasnapshotovanou do každého řádku ledgeru. Kdo text změní, bumpne verzi — staré souhlasy tím zůstanou navázané na znění, které lidé skutečně viděli.

**Správce.** Existující zásady Weeks mají dva správce: DDM Praha 6 pro pražské tábory a Lukáše Kubíka, IČO 24878511, pro Karlovy Vary. Učebna je celostátní produkt s vlastní pokladnou, což podle auditu (kap. M8) znamená Karlovy Vary. Správcem je proto **Lukáš Kubík, IČO 24878511** — vedený jako jedna konstanta `CONTROLLER` a jako jediná právní věc v tomhle dokumentu, kterou jsem odvodil, ne ověřil. Patří na začátek handoffu.

**Struktura obrazovky.** Tři nezávislé prvky, žádný předvyplněný:

| Prvek | Typ | Povinné |
|---|---|---|
| Podmínky užití a zásady ochrany údajů | potvrzení, čl. 6 odst. 1 písm. b) | ano |
| Souhlas zákonného zástupce se zpracováním údajů dítěte | souhlas, čl. 6 odst. 1 písm. a) + čl. 8 | ano |
| Obchodní sdělení | souhlas, čl. 6 odst. 1 písm. a) | ne |

Sdružený box „souhlasím se vším" by byl neplatný — souhlas musí být konkrétní a oddělitelný.

**Co se u souhlasu ukládá:** čas, verze, plné znění v okamžiku udělení, IP adresa a user agent. IP a UA na oprávněném zájmu jako doklad o udělení — stejný vzorec, jaký už zásady pro Karlovy Vary používají.

## 7. Design

Základ je větev `weeks_web@design/maker-lab` — technický výkres, ne dětská grafika. Bricolage Grotesque na nadpisy, Instrument Sans na text, IBM Plex Mono na čísla a technická metadata. Paper `#FAFAF7` a ink `#0C0E1A` jako neutrály, indigo `#4F46E5` jako primární, cyan `#06B6D4` jako akcent, emerald `#10B981` na důvěru, amber `#F59E0B` na CTA. Tvrdé stíny místo měkkých, `rounded-md` místo `rounded-2xl`, blueprint mřížka, rohové registrační značky na kartách.

Weeks web jede na Tailwindu v3 s `tailwind.config.ts`. Učebna je na v4, kde konfigurace žije inline v `globals.css` pod `@theme`. Tokeny se tedy portují, ne kopírují.

**Dvě hlasitosti, jeden systém.** Stejné tokeny, jiná dynamika:

| | Dětská zóna | Rodičovská zóna a auth |
|---|---|---|
| Hustota | vzdušná, velké cíle | kompaktní, formulářová |
| Barva | amber a cyan nesou akci | indigo a ink, amber jen na hlavní CTA |
| Pohyb | oslava po dokončení lekce | jen přechody stavů |
| Typografie | větší display, kratší řádky | menší, delší řádky, mono na údaje |

Rodič v té zóně dává souhlas a později platí kartou. Musí působit jako nástroj, ne jako hra.

**Responzivita.** Mobile-first. Dítě přichází z Reels na telefonu, rodič vyplňuje souhlas nejspíš taky na telefonu — celý wizard i rodičovská zóna proto musí být plně použitelné od 320 px. Circuit builder a 3D studio potřebují desktop a řeknou to poctivě, místo aby se rozpadly.

**Přístupnost.** Wizard hlásí krok přes `aria-current` a po přechodu přesouvá fokus na nadpis kroku. Chyby jdou do `aria-live="polite"` a zároveň se váží na pole přes `aria-describedby`. Každý input má `<label>` svázaný přes `for`/`id`. Kontrast textu min. 4,5:1 — ink na paper i paper na ink to splňují. Vše ovladatelné klávesnicí, focus ring viditelný. `prefers-reduced-motion` vypíná oslavy i ticker.

## 8. Bezpečnost

| Oblast | Opatření |
|---|---|
| Zápis | Výhradně přes Server Actions se Zod validací. Klient neposílá ID, která si může vymyslet. |
| Rate limit | Registrace 5/h/IP, přihlášení 10/15 min/IP+e-mail, magic link 3/h/e-mail, PIN 5/15 min/dítě, waitlist 3/h/IP. |
| Výčet účtů | Registrace i obnova hesla odpovídají stejně bez ohledu na to, jestli adresa existuje. |
| Hesla | Min. 10 znaků, kontrola proti seznamu nejčastějších. Hashuje Supabase. |
| PIN | scrypt + `timingSafeEqual`, výhradně na serveru, sloupec mimo klientský grant. |
| Otevřené přesměrování | `next` parametr jen relativní cesta — přebírá se ověřená `isSafeNextPath` z legacy callbacku. |
| Hlavičky | CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`. |
| Servisní klíč | Jen v Server Actions a route handlerech, nikdy v komponentě bez `"use server"`. |
| Souhlas | IP a UA se ukládají jen u souhlasu, ne u každého požadavku. |
| Auth hook | Podpis Standard Webhooks se ověřuje před odesláním e-mailu. |

## 9. Měření

Události, které brána 1 potřebuje a dnes chybí (nález N4): `lesson_start`, `lesson_complete`, `signup_prompt_view`, `signup_parent`. Bez `lesson_start` se hlavní metrika — dokončení z těch, kdo začali — nedá spočítat vůbec.

Kritické: události posílá i **anonymní** relace pod svým `anonId`. Dnešek posílá jen přihlášený uživatel, takže jmenovatel metriky chybí ze samé podstaty.

UTM se zachytí při první návštěvě, uloží do `localStorage` a při registraci se přepíše na řádek rodiče. Bez toho se všechno připíše přímé návštěvnosti.

Do brány 1 stačí SQL dotaz spuštěný jednou měsíčně — dashboard se staví až po ní. Dotazy pro každou metriku brány dodám jako `docs/metriky-brana-1.sql`.

## 10. Testy

Vitest je v repu. TDD na věcech, kde chyba je tichá a drahá:

- `regions` — mapování kraj → segment (spád vs. čekačka), včetně tří spádových krajů
- `birth_year` → věkové pásmo, hranice 15 let, odmítnutí nesmyslných ročníků
- `consents` — poslední řádek vyhrává, odvolání, verzování
- `pin` — hash, ověření, odolnost proti časovému úniku, zamčení po pěti pokusech
- `adoptAnonymousSession` — idempotence, přemapování slugů, ořezání podvržených časů
- `isSafeNextPath` — převzaté testy plus doplněné případy
- Zod schémata všech formulářů — hraniční a nepřátelské vstupy

## 11. Co musí naklikat člověk

Půjde do handoffu i jako samostatný `docs/handoff-ucebna-v2.md`:

1. Založit nový Supabase projekt, pustit migrace, doplnit env.
2. Zapnout Google OAuth (Google Cloud + Supabase provider).
3. Zapnout Send Email Hook v Supabase a vložit secret.
4. Ověřit doménu v Resend pro odesílání z `@weeks.cz`.
5. Doplnit env do Vercelu pro preview i produkci.
6. **Zkontrolovat rozpor v dnešním `.env.local`:** `NEXT_PUBLIC_SUPABASE_URL` a `SUPABASE_URL` míří na dva různé projekty. Server tedy píše jinam, než čte klient.
7. Potvrdit, že správcem údajů pro učebnu je Lukáš Kubík, IČO 24878511.

## 12. Otevřené body

| # | Věc | Kdo | Proč to nespěchá dnes |
|---|---|---|---|
| 1 | Právní revize znění `parental-v1` | Lukáš / právník | Mechanika i verzování fungují; výměna textu je bump verze. |
| 2 | Identita správce | Lukáš | Odvozeno z toho, že učebna jede přes vlastní pokladnu. Jedna konstanta. |
| 3 | Obsah lekce 1 a video | tým | Blok 1.3. Kostra routy počítá s tím, že obsah přijde jako data. |
| 4 | Seznam měst pro čekačku | Lukáš | Volný text s našeptávačem stačí; normalizace až podle skutečných dat. |
