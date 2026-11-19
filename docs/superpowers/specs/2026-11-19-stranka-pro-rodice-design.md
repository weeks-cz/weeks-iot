# Učebna – stránka pro rodiče z reklamy („Pošlete si odkaz na počítač“)

Návrh k implementaci. 19. listopadu 2026.

| | |
|---|---|
| Na co navazuje | Placená reklama na Facebooku a Instagramu míří na `/`. Měření v `learning_events` ukázalo, že návštěvníci z ní lekci spustí a hned odejdou. |
| Co tenhle dokument řeší | Novou stránku `/pro-rodice`, na kterou bude mířit reklama. Na telefonu sbírá e-mail a posílá odkaz na počítač, na počítači pouští rovnou do lekce. |
| Co neřeší | Úpravy dětské úvodní stránky `/`, obsah lekcí, ovládání lekcí na mobilu, novou kampaň v Ads Manageru. |

---

## 1. Proč

Reklama oslovuje **rodiče** a většina z nich ji vidí **na telefonu**, často ve vestavěném prohlížeči Facebooku nebo Instagramu. Učebna je stavěná pro **dítě u počítače**. Úvodní stránka mu tyká („Postav si vlastní techniku“) a hlavní tlačítko vede rovnou do lekce 1.

Data od spuštění reklamy (`learning_events`, `visit_first.props.utm_source = 'meta'`):

- Většina návštěv z reklamy přichází ve vestavěném prohlížeči Facebooku nebo Instagramu, tedy na telefonu.
- Část návštěvníků lekci 1 spustí, ale skoro všechny tyhle relace po `lesson_start` končí, bez nápovědy a bez dokončení.
- Žáci, kteří ve stejném období přišli na počítači (přes školu), prošli celý kurz.

Závěr: nejde o rozbitou lekci na mobilu. Rodič na telefonu prostě není ten, kdo lekci dělá. Zaplacená návštěva pak odejde a nenechá po sobě nic, ani e-mail.

**Cíl:** rodič, který na reklamu klikne na telefonu, odejde s pocitem „pošlu si to a dítě to večer zkusí na počítači“ a **nechá nám e-mail**. Rodič, který klikne na počítači, se dostane do lekce stejně rychle jako dnes.

## 2. Cíle, ne-cíle, anti-cíle

**Cíle**

1. Stránka `/pro-rodice` mluví k rodiči (vyká) a říká jen ověřené věci: zdarma, nic se neinstaluje, v prohlížeči, 7 lekcí po 20–30 minutách, certifikát na konci, první lekce bez účtu, pro děti od 9 let (stejně jako dnešní `/`; horní hranici stránka neuvádí – *rozhodnutí návrhu*).
2. Na telefonu je hlavní akcí formulář s jedním polem: **„Pošlete si odkaz na počítač“**. Hned u formuláře stojí, proč: na počítači s myší je to pro dítě mnohem lepší zážitek (větší plocha, přesné zapojování).
3. Po odeslání přijde transakční e-mail s odkazem do učebny. Odkaz nese původní UTM z reklamy, aby se pozdější registrace na počítači pořád připsala reklamě.
4. Žádost se uloží do databáze učebny, kde ji uvidí metriky brány 1 vedle registrací.
5. Na počítači je hlavní akcí „Začít první lekci“ a formulář je jen druhou možností („Poslat odkaz na jiný počítač“).
6. Pod polem je samostatné, předem nezaškrtnuté zaškrtávátko pro další e-maily. Kdo ho zaškrtne a do dvou dnů odkaz neotevře, dostane **jednu připomínku**. Každý takový e-mail má odhlašovací odkaz, který funguje bez účtu (§6). *Rozhodl Lukáš 19. 11. 2026: varianta c).*

**Ne-cíle**

- Úpravy dětské úvodní stránky `/`. Komponenta formuláře se má dát později vložit i tam (varianta „přepínač podle zařízení“), ale teď se tam nevkládá.
- Úpravy lekcí kvůli ovládání prstem.
- Formulář přímo ve Facebooku (Meta lead form). To je samostatný možný test, až tahle stránka poběží.
- Víc než jedna připomínka, novinky nebo nabídky táborů těm, kdo nechali jen e-mail. Souhlas k tomu se sice sbírá, ale obsah se bude řešit zvlášť.

**Anti-cíle** (tohle by byl neúspěch, i kdyby to technicky fungovalo)

- **Zablokovat telefon.** Na telefonu musí zůstat viditelný odkaz „Přesto zkusit na telefonu“, který vede do lekce. Dítě s tabletem nesmí narazit na zeď.
- Posílat cokoli dalšího bez výslovného souhlasu. Odkaz, o který si rodič řekl, je služba. Připomínka nebo novinka je obchodní sdělení.
- Tvrdit neověřené věci, třeba „uvidíte postup dítěte“ nebo počty uživatelů.
- Zpomalit cestu z počítače. Rodič na počítači nesmí nad lekcí vidět formulář jako překážku.

## 3. Přístupy, které se zvažovaly

| | Jak | Co to stojí | Rozhodnutí |
|---|---|---|---|
| **A. Přepínač na `/` podle zařízení** | Na telefonu otevře „Zkusit první lekci“ okno s e-mailem, počítač beze změny. | Chytí i neplacený mobilní provoz. Rodič ale dál přistává na stránce, která tyká dítěti. | Teď ne. Komponenta formuláře se dá použít později. |
| **B. Stránka pro rodiče `/pro-rodice`** | Reklama míří sem. Vyká, na telefonu sbírá e-mail, na počítači pouští do lekce. | Nová stránka a změna URL v reklamě, takže nové schválení u Mety. | **Zvoleno** (Lukáš, 19. 11. 2026). |
| **C. Meta lead form** | E-mail se zadá uvnitř Facebooku. | Nová kampaň s cílem Leads, kontakty mimo databázi učebny, bývají méně kvalitní. | Možný pozdější souběžný test. |

Proč B: opravuje oba nesoulady najednou. Mluví k tomu, kdo platí, a přizpůsobí se zařízení, na kterém je. E-maily přitom končí ve vlastní databázi.

## 4. Stránka `/pro-rodice`

Routa `src/app/(public)/pro-rodice/page.tsx`, statická, se stejnou veřejnou hlavičkou a patičkou jako `/`. `noindex`: je to vstupní stránka pro reklamu a nemá v Googlu soutěžit s `/`.

Pořadí bloků na telefonu (počítač má stejný obsah ve dvou sloupcích):

```
┌───────────────────────────────┐
│ W Weeks               Přihlásit│
├───────────────────────────────┤
│ ONLINE UČEBNA · DĚTI OD 9 LET  │
│ Arduino pro vaše dítě.         │
│ Zdarma, v prohlížeči.          │
│                                │
│ Dítě si zapojí obvod, naprogra-│
│ muje ho a uvidí LEDku svítit.  │
│                                │
│ ┌────────────────────────────┐ │
│ │ Nejlíp to jde na počítači  │ │
│ │ s myší. Pošleme vám odkaz: │ │
│ │ [ váš e-mail            ]  │ │
│ │ [ Poslat odkaz na počítač ]│ │
│ │ ☐ Občas mi pošlete tip ... │ │
│ │ Odesláním… ochrana údajů   │ │
│ └────────────────────────────┘ │
│   Přesto zkusit na telefonu →  │
├───────────────────────────────┤
│ [video 9:16 z reklamy]         │
├───────────────────────────────┤
│ Co dítě čeká: 7 lekcí po 20–30 │
│ min · bloky i kód · certifikát │
├───────────────────────────────┤
│ Pro rodiče: zdarma, nic se ne- │
│ instaluje, první lekce bez účtu│
│ účet zakládá rodič             │
├───────────────────────────────┤
│ Kdo za tím stojí: Weeks, letní │
│ tábory → odkaz na weeks.cz     │
└───────────────────────────────┘
```

**Rozhodnutí podle zařízení** padá na klientovi podle `matchMedia("(pointer: coarse)")`, ne podle user agentu. Server vykreslí variantu pro telefon (formulář nahoře), protože odtud přichází většina provozu z reklamy. Na počítači se po hydrataci prohodí pořadí: nahoře „Začít první lekci“, formulář pod ním s nadpisem „Poslat odkaz na jiný počítač“. Obsah je v HTML v obou případech, skript jen mění pořadí a texty (pravidlo „skripty přidávají, nic neodkrývají“, viz weeks-web).

**Texty** se píšou vykáním a česky typograficky: `sazba`/nezlomitelné mezery u čísel s jednotkou, krátká pomlčka. Konkrétní znění je na builderovi, ale nesmí obsahovat nic mimo fakta v §2.1. Faktům odpovídá dnešní landing a `courses`/`lessons` v databázi.

**Video:** existující 9:16 MP4 z reklamy (v6) – zdroj `C:\Users\lukol\Downloads\ucebna-video\ucebna-v6-9x16.mp4` (9,2 MB, mimo repo; vektorově překreslené UI učebny a AI hlas, žádné dítě ani reálná osoba, takže pravidlo o souhlasu s fotkou dítěte se ho netýká). Do `public/` jde přeenkódovaná kopie, `muted`, `playsinline`, `preload="none"`, s plakátem. Soubor se zmenší pod ~3 MB. Když to nepůjde, video vypadne a nahradí ho statický snímek. Stránka nesmí kvůli videu načítat pomalu na mobilních datech.

## 5. Formulář a ukládání

### 5.1 Data

Nová tabulka (migrace `015_ucebna_odkaz_na_pc.sql`):

```sql
create table public.device_link_requests (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null,
  -- Původ návštěvy, ze které rodič odeslal formulář (z anon-session attribution).
  utm_source    text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  referrer      text,
  env           text,           -- 'facebook' | 'instagram' | 'browser' (analytics/environment.ts)
  marketing_consent boolean not null default false,  -- aktuální stav; doklad je v ledgeru consents
  sent_at       timestamptz,    -- kdy odešel e-mail s odkazem (null = selhal)
  send_error    text,
  opened_at     timestamptz,    -- první otevření odkazu (viz 5.3)
  reminder_sent_at timestamptz, -- jediná připomínka (§6)
  unsubscribed_at  timestamptz,
  anonymized_at    timestamptz, -- e-mail smazán po uplynutí lhůty (§6)
  created_at    timestamptz not null default now()
);
```

Kvůli anonymizaci musí být `email` nullable (`email citext`, bez `not null`). Kontrolní omezení zajistí, že e-mail chybí jen u anonymizovaného řádku.

**Ledger souhlasů:** od migrace 013 má `consents.parent_id` povolené NULL. Migrace 015 přidá sloupec `consents.device_link_request_id uuid references device_link_requests(id) on delete set null`. Udělení souhlasu při odeslání formuláře a jeho odvolání přes odhlašovací odkaz jsou dva append-only řádky `kind = 'marketing'` navázané na žádost (verze a `text_snapshot` z `consent/texts.ts`, IP a user agent jako u ostatních souhlasů). Když se rodič později zaregistruje, dává souhlas v onboardingu znovu jako dosud. Žádost se do jeho účtu nepřenáší (*rozhodnutí návrhu*).

**Vztah k pravidlu „anonymní relace nesmí nic poslat na server“ (AGENTS.md):** pravidlo chrání *postup dítěte* před registrací. Odeslání formuláře je výslovný úkon rodiče se zřejmým účelem, stejně jako registrace. Na server proto jde jen to, co rodič vyplnil, plus zdroj návštěvy. **Žádné `anon_id`** a nic z postupu v lekci. E-mail se tak nespojí s pseudonymními událostmi z `learning_events` (*rozhodnutí návrhu*). Metrika „žádost → registrace“ se páruje přes `utm_term=odkaz-na-pc` (§5.3), ne přes relaci.

RLS zapnuté, **žádný grant pro `anon` ani `authenticated`**. Zapisuje výhradně Server Action pod servisní rolí, stejně jako `email_log`. Opakované odeslání stejné adresy do 10 minut po úspěšném odeslání e-mail znovu nepošle (dedupe), další pokusy brzdí rate limit (5.2).

### 5.2 Server Action

`src/features/device-link/actions.ts`, `"use server"`, Zod schéma v `schema.ts`:

- Vstup: `email` (validní, ořezaný, nejvýš 254 znaků), `marketingConsent` (boolean) a attribution z anon-session (klient posílá UTM, které už zachytil `captureAttribution`; server je jen zkrátí a uloží, nic z nich nevyvozuje).
- Rate limit: nový kbelík `deviceLink` (např. 3 za hodinu na IP **a** 3 za hodinu na e-mail). Tím se z formuláře nestane nástroj na posílání e-mailů cizím lidem.
- Honeypot pole proti robotům (skryté, vyplněné = tiché „hotovo“ bez odeslání).
- Odeslání přes `sendTemplate` (`src/lib/email/send.ts`), nová šablona v `templates.ts`.
- Odpověď klientovi je vždy „Hotovo, odkaz je na cestě na …“, i když Resend selže. Chyba se zapíše do `send_error`, aby se dala dohledat.

### 5.3 E-mail

- **Předmět:** „Odkaz na Učebnu Weeks pro vaše dítě“ (návrh).
- **Obsah:** jedno velké tlačítko „Otevřít učebnu“. Pod ním co dítě potřebuje (počítač nebo notebook, ideálně myš, asi 20 minut) a že první lekci zkusí bez účtu, ale pro uložení postupu a certifikát založí účet rodič.
- **Odkaz:** `https://ucebna.weeks.cz/kurz/iot/rozsvit-ledku/?utm_source=<původní>&utm_medium=<původní>&utm_campaign=<původní>&utm_content=<původní>&utm_term=odkaz-na-pc&odkaz=<token>`.
  - Původní UTM se nese dál, takže `captureAttribution` na počítači zapíše stejný zdroj jako na telefonu a registrace se připíše reklamě.
  - `utm_term=odkaz-na-pc` odliší návštěvy, které přišly přes e-mail.
  - Když původní UTM chybí, použije se `utm_source=ucebna&utm_medium=email&utm_campaign=odkaz-na-pc`.
- **Proč odkaz rovnou do lekce 1, ne na `/`:** rodič už je rozhodnutý a dítě má sednout a začít.
- **`odkaz=<token>`:** podepsané `id` žádosti (HMAC, viz §6). Při první návštěvě s tímhle parametrem **na počítači** (`pointer: fine`) se vyplní `opened_at` (serverová akce, idempotentní, nepodepsaný token se ignoruje). Otevření na telefonu se jen zapíše jako událost a připomínku nezruší, protože rodič často klepne na mail na stejném telefonu, ze kterého formulář odeslal (*rozhodnutí návrhu*). Událost zapisuje server bez `anon_id`. Parametr `odkaz` se po zachycení z adresy odstraní a do `landing_path` se neukládá, protože je to zároveň klíč k odhlášení.. Díky tomu víme, kolik odkazů někdo opravdu otevřel.
- **Patička:** kdo e-mail posílá a proč („požádali jste o odkaz na …“). Když je zaškrtnutý marketingový souhlas, už první e-mail nese odkaz „Nechci další e-maily“, viz §6.

### 5.4 Měření

Nové události v `analytics/events.ts`:

- `device_link_view`: zobrazení formuláře, nese `variant: 'mobile' | 'desktop'`.
- `device_link_submit`: úspěšné odeslání (bez e-mailu v props).
- `device_link_open`: otevření odkazu z e-mailu.
- `parent_page_lesson_click`: klik na „Začít první lekci“ nebo „Přesto zkusit na telefonu“, nese `placement`.

Meta Pixel (jen po souhlasu s cookies, jako dnes) dostane při odeslání standardní událost `Lead`. Přes Conversions API (`meta-capi.ts`) se `Lead` se stejným `event_id` pošle **jen při zaškrtnutém marketingovém souhlasu**, stejně jako dnes `CompleteRegistration` v onboardingu (*rozhodnutí návrhu*). Bez `META_CAPI_ACCESS_TOKEN` v produkci je volání tichý no-op. Builder před nasazením ověří ve Vercelu, jestli tam token je. Rozhodnout, jestli se kampaň přepne z optimalizace na „Landing page views“ na „Leads“, je až věc reklamy. Při malém rozpočtu je to spíš ne, kvůli fázi učení.

Metriky brány 1 (`features/metrics/queries.ts` + `docs/metriky-brana-1.sql`) dostanou řádek „Odkaz na počítač: vyžádáno / otevřeno / → registrace“. Ten, kdo mění jeden soubor, mění i druhý.

## 6. Souhlasy a ochrana údajů

- **Odkaz, o který si rodič řekl, je plnění žádosti**, ne obchodní sdělení. Posílá se bez zaškrtávátka. Pod tlačítkem je jedna věta, že e-mail použijeme k odeslání odkazu, a odkaz na `/ochrana-udaju`.
- **Cokoli dalšího** (připomínka „dítě to ještě nezkusilo“, tipy, tábory) **jen se samostatným, předem nezaškrtnutým souhlasem.** Znění jde do `consent/texts.ts` jako nová položka s vlastní verzí. Řekne, co přijde: připomínka k odkazu a občas tip z učebny a nabídka táborů Weeks. Odvolat se dá kdykoli odkazem v každém e-mailu.
- **Připomínka:** posílá ji existující denní cron `/api/cron/email-sequence` (běží v 9:00 UTC) jako další krok. Kandidát je žádost, která má `marketing_consent = true`, `sent_at` vyplněné, `opened_at`, `reminder_sent_at`, `unsubscribed_at` i `anonymized_at` prázdné, a od `created_at` uplynulo 48 hodin až 7 dní. Přeskočí se e-mail, pod kterým už existuje účet v `parents`. Pro jistotu se `reminder_sent_at` zapíše před odesláním, takže druhé spuštění cronu ji nepošle znovu. Text je krátký: „Dítě se k učebně ještě nedostalo? Tady je odkaz znovu.“ Stejný odkaz (§5.3) s `utm_term=pripominka-na-pc`, aby šla připomínka změřit zvlášť.
- **Neověřená adresa:** formulář nikdo neověřuje, takže kdokoli může zadat cizí e-mail i se souhlasem. Proto platí, že připomínka (nejvýš jedna, s odhlášením) jde i na neověřenou adresu. **Cokoli dalšího** (tipy, tábory) se smí poslat jen adrese, jejíž majitel odkaz aspoň jednou otevřel na jakémkoli zařízení, protože tím prokázal, že schránku vlastní. Limit na e-mail se počítá z očištěné adresy (bez `+štítku`, u Gmailu bez teček), aby nešel obejít.
- **Odhlášení bez účtu:** odkaz `https://ucebna.weeks.cz/odhlasit?t=<token>`. Token je `id` žádosti podepsané HMAC-SHA256 novým tajemstvím `DEVICE_LINK_SECRET` (env, Production i Preview; stejný podepsaný token nese i odkaz v e-mailu jako `odkaz=<token>`). Stránka po otevření **nic nemění**, jen ukáže tlačítko „Odhlásit“. Bezpečnostní skenery pošty odkazy otevírají a jinak by lidi odhlašovaly samy. Tlačítko spustí Server Action, která ověří podpis, zapíše do ledgeru řádek `granted = false`, nastaví `marketing_consent = false` a `unsubscribed_at` a ukáže potvrzení. Druhé kliknutí nic nezdvojí. E-maily s marketingovým souhlasem nesou i hlavičku `List-Unsubscribe` s touž URL. Jestli doplnit i one-click POST podle RFC 8058, je na builderovi.
- **Uchování** (potvrdil Lukáš 19. 11. 2026): žádost **bez** marketingového souhlasu nebo po odhlášení se po **90 dnech** od vytvoření anonymizuje. E-mail se smaže, vyplní se `anonymized_at` a řádek zůstane kvůli statistice. Žádost se souhlasem se drží do odvolání. Anonymizaci dělá tentýž denní cron. Řádky ledgeru zůstávají jako doklad (stejně jako u smazaného účtu, migrace 013).
- **`/ochrana-udaju`** dostane odstavec: jaká data se ukládají (e-mail, zdroj návštěvy), proč (odeslání odkazu, měření, u kterého kanálu má smysl platit), jak dlouho, kdo je zpracovatel (Resend už v dokumentu je). Text je návrh pro právníka, stejně jako zbytek stránky.

## 7. Reklama (mimo kód, po nasazení)

- Reklama je do nasazení stránky pozastavená.
- Po nasazení míří reklama na `https://ucebna.weeks.cz/pro-rodice` s vlastními UTM parametry.
- Všechno v Ads Manageru jen s výslovným OK Lukáše.

## 8. Co zůstává na builderovi

- Přesné texty stránky a e-mailu, v mezích §2.1 a anti-cílů. Před nasazením je uvidí Lukáš.
- Texty připomínky, odhlašovací stránky a nového souhlasu. Před nasazením je uvidí Lukáš.
- Párování žádosti s pozdější registrací: přes `utm_term=odkaz-na-pc` v `parents.utm_term` stačí pro metriku. Přímé spárování přes `odkaz=<id>` → `parents` je volitelné.
- Velikost a formát videa, plakát.
- Kam patří komponenta formuláře, aby šla později vložit na `/` (např. `features/device-link/components/DeviceLinkForm.tsx`).

## 9. Jak poznáme, že to funguje

Po týdnu provozu s reklamou na nové URL:

- **Hlavní:** podíl návštěv z reklamy na telefonu, které nechají e-mail. Orientační laťka je aspoň 10 %. Pod 5 % je špatně stránka nebo nabídka.
- Podíl odeslaných odkazů, které se otevřou na počítači (`device_link_open` / `device_link_submit`).
- Registrace s `utm_term=odkaz-na-pc` a dokončené lekce u nich.
- Kontrola, že se nezhoršil počítač: návštěva → `lesson_start` u `variant: 'desktop'` nesmí být horší než dnes na `/`.

## 10. Testy

- Zod schéma: neplatný e-mail, příliš dlouhé UTM, honeypot.
- Server Action: rate limit podle IP i e-mailu, selhání Resendu → uživatel vidí „hotovo“, `send_error` vyplněné.
- Sestavení odkazu: původní UTM se přenesou, bez nich se použije výchozí, `utm_term` se vždy přepíše na `odkaz-na-pc`.
- `opened_at`: druhé otevření ho nepřepíše.
- Připomínka: výběr kandidátů (bez souhlasu, otevřený odkaz, odhlášený, mladší 48 h, starší 7 dní, existující účet → nic), opakované spuštění cronu nepošle dvakrát.
- Odhlášení: neplatný nebo cizí podpis → chyba bez zápisu. Otevření stránky nic nezmění, zapíše až tlačítko. Dvojí kliknutí → jeden řádek v ledgeru.
- Anonymizace: po 90 dnech zmizí e-mail jen u žádostí bez platného souhlasu.
- E2E (Playwright, profil iPhone): `/pro-rodice` ukáže formulář nahoře a „Přesto zkusit na telefonu“ vede do lekce. Na desktopu je nahoře „Začít první lekci“.
- Migrace: RLS zapnuté, žádný grant pro `anon`/`authenticated` (test, který čte migraci jako text, podle vzoru `seed.test.ts`).
