# Učebna — lobby, hlavička, oslavy a sbírka

Návrh k implementaci. 26. října 2026.

| | |
|---|---|
| Na co navazuje | Lukášův průchod všemi sedmi lekcemi 25.–26. 10. Lekce samotné fungují; obal kolem nich ne. |
| Co tenhle dokument řeší | Domovskou obrazovku dítěte (lobby), jednotnou hlavičku s logem, oslavu po lekci a finále kurzu s certifikátem, sbírku postavených obvodů, změnu avataru a pozvánku na tábor uvnitř aplikace. |
| Co neřeší | Obsah lekcí, nové kurzy, gamifikaci (body, odznaky, série dní), platby, rodičovskou zónu kromě odkazu zpět do učebny. |
| Náhledy | `docs/superpowers/mockups/2026-10-26-lobby/` — `lobby-kombinace.html` (schválený směr lobby) a `finale.html` (finále a malá oslava). Otevřít v prohlížeči přímo ze složky. Liška v náhledech je ilustrační — skutečné avatary viz §10. |

---

## 1. Proč

Lekce jsou podle zakladatele „udělané fakt dobře“. Kolem nich ale aplikace nemá domov:

- **Žádné místo, odkud se lekce spouští.** `/ucim-se` je pozdrav, progress bar a jedna karta. Přehled lekcí je jinde (`/kurz/iot`) a dítě o něm neví.
- **Slepá logo.** V lekci má přihlášené dítě veřejnou hlavičku: logo vede na marketingovou `/`, kde je „Přihlásit“, ačkoli přihlášené je. Na `/ucim-se` logo vede na tutéž stránku. Z lekce se zpátky „domů“ nedá dostat jinak než přes konec lekce.
- **Odkud do rodiče?** Z dětské části do `/ucet` nevede žádný odkaz.
- **Suchý konec.** Po lekci zelená kartička „Lekce je hotová“, po celém kurzu „Zpět na přehled“ a věta, že certifikát je v účtu rodiče. Konfety jsou, odměna ne.
- **Málo značky.** Logo je jen text „Weeks Učebna“; skutečné W v aplikaci není vůbec.

**Cíl:** dítě sedne k počítači, otevře učebnu a **během pár vteřin ví, kde skončilo a kde pokračuje — a chce pokračovat**. Konec lekce i kurzu má být chvíle, na kterou se těší.

## 2. Cíle, ne-cíle, anti-cíle

**Cíle**

1. Lobby jako jediný domov dítěte: jedno velké „Pokračovat“, kde skončilo, mapa celé cesty kurzem, co postavilo, certifikát, pozvánka na tábor.
2. Jedna hlavička v celé dětské části i v lekcích, se skutečným logem W, která ví, kdo je přihlášený.
3. Z každého místa se dá dostat do lobby, přepnout profil a jít do účtu rodiče.
4. Oslava po každé lekci a velké finále po posledním kurzu s certifikátem, který přiletí a naklání se ve 3D.
5. Sbírka toho, co dítě postavilo — obvody z hotových lekcí se od teď ukládají.
6. Dítě si může změnit avatar.

**Ne-cíle**

- Gamifikace: tituly, body, odznaky, série dní. Lobby na ně má mít místo, ale nic z toho se teď nestaví. Žádná čísla, která aplikace neměří (např. „čas u stolu“ — `duration_s` existuje jen pro dokončené lekce a sčítat ho jako „hodiny u stolu“ by klamalo).
- Další kurzy. Nevymýšlet dlaždice „Herní vývoj“ ani „chystáme“ s názvy kurzů, které neexistují. Lobby se má umět rozšířit, až druhý kurz bude v DB.
- Přestavba rodičovské zóny (`/ucet`). Dostane jen odkaz zpět do učebny.
- Změna PDF certifikátu (`features/certificates/pdf.tsx`). Mění se jen to, jak ho dítě uvidí.

**Anti-cíle** (i kdyby to technicky fungovalo, bylo by to selhání)

- Lobby, kde „Pokračovat“ není to první, co oko najde. Všechno ostatní je podřízené.
- Animace, které zdržují: oslava nesmí bránit kliknout na „Další lekce“. Certifikát se nesmí načítat tak dlouho, že dítě odejde.
- Dětská grafika. Design systém je „technický výkres, ne dětská grafika“ (`globals.css`). Gradient a velké W ano, kreslené bubliny a duhy ne.
- Víc než jedna amber akce na obrazovce (pravidlo projektu, `Button.tsx`).
- Tvrzení, která aplikace nemůže doložit (termíny, ceny, počty) — viz §8.

## 3. Rozhodnutí

| # | Rozhodnutí | Kdo |
|---|---|---|
| R1 | Vizuální směr = kombinace: celkový vzhled „hráčského profilu“ (tmavý gradient indigo → ink → tmavý cyan, velké průhledné W, avatar se jménem vlevo), věta „co teď čeká“ + karta rozdělané lekce + mapa cesty z „mapy cesty“, pozvánka na léto ve stylu „dílny“. | Lukáš (náhled `lobby-kombinace.html`) |
| R2 | Spodní řada lobby: tři sekce **stejné velikosti a váhy** — Co jsi postavil · Certifikát · Léto. Na náhledu jsou nestejné; to je chyba náhledu. | Lukáš |
| R3 | Finále kurzu podle `finale.html`: konfety, nadpis se jménem, certifikát, který přiletí a při pohybu myši se naklání ve 3D s odleskem; tlačítka „Stáhnout certifikát“ a „Zpět do lobby“; pod tím „Co dál“ a pozvánka na tábor. 3D má být „fakt dotažené“. | Lukáš |
| R4 | Po běžné lekci menší oslava: konfety, krátká věta o tom, co dítě postavilo, mini mapa, náhled další lekce, „Další lekce“ + „Do lobby“. Žádný certifikát. | Lukáš |
| R5 | Dítě bez účtu vidí stejné finále; na certifikátu „Tvoje jméno“, hlavní tlačítko „Ulož si postup a získej certifikát“ → registrace rodiče. | Lukáš |
| R6 | Pozvánka na tábor jen tehdy, když nějaký termín je v prodeji; data se neopisují (viz §8). | návrh, Lukáš souhlasil |
| R7 | Uživatelé s „omezit animace“ dostanou statickou verzi (bez letu certifikátu, bez konfet, bez náklonu). | návrh, Lukáš souhlasil |
| R8 | Všechno v jedné dávce, kvalitně, žádné „zbytek příští týden“. | Lukáš |

## 4. Struktura aplikace

### 4.1 Mapa rout

| Routa | Kdo | Co | Změna |
|---|---|---|---|
| `/` | všichni | marketingová vstupní stránka | beze změny obsahu; hlavička viz §5 |
| `/ucim-se` | přihlášený | **lobby** (bez aktivního profilu: výběr profilu jako dnes) | přepsáno |
| `/ucim-se/sbirka` | přihlášený s profilem | **sbírka**: postavené obvody + certifikáty | nové |
| `/ucim-se/sbirka/[lekce]` | přihlášený s profilem | detail jednoho výtvoru: obvod a program jen ke čtení, „Otevřít lekci znovu“ | nové |
| `/ucim-se/avatar` | přihlášený s profilem | výběr avataru | nové |
| `/ucim-se/prepnout` | přihlášený | výběr profilu | jen nová hlavička |
| `/kurz/[slug]` | všichni | přehled kurzu; **pro anonyma s postupem i „lobby bez účtu“** (§6.6) | upraveno |
| `/kurz/[slug]/[lekce]` | všichni | lekce | nová hlavička, nové konce (§7) |
| `/ucet/**` | rodič | rodičovská zóna | jen odkaz „Do učebny“ v hlavičce |

**Kam vede logo** (dnes nejčastější slepá ulička):

- přihlášený s aktivním profilem → `/ucim-se` (lobby), ze všech stránek včetně lekcí a `/`;
- přihlášený bez aktivního profilu → `/ucim-se` (ukáže výběr profilu);
- anonym s postupem v anonymní relaci → `/kurz/iot`;
- anonym bez postupu → `/`;
- v rodičovské zóně → `/ucet` (beze změny), vedle je „Do učebny“.

Logo nikdy neodkazuje na stránku, na které uživatel právě je, bez důvodu — na lobby je klik na logo povolený, ale nic nerozbije.

### 4.2 Hlavička (`AppHeader`)

Jedna komponenta pro dětskou část, lekce a přehled kurzu. Server component, čte session a aktivní profil (`getActiveChild`). Tmavá (ink) s jemným spodním okrajem, výška 64 px, lepivá jako dnešní `PublicHeader`.

- **Vlevo:** skutečné logo — W z weeks.cz (`weeks_web/public/images/weeks-logo.png`, gradient světle modrá → indigo) + „Weeks“ + mono „UČEBNA“ v cyan. Do repa jako optimalizovaný asset (ideálně SVG, PNG 2× je přijatelný fallback). `Logo` komponenta dostane variantu s W; textová verze zůstává pro patičku a e-maily.
- **Uprostřed (přihlášený s profilem):** Domů (`/ucim-se`) · Kurzy (`/kurz/iot` — dokud je kurz jeden) · Sbírka (`/ucim-se/sbirka`). Aktivní položka podtržená. Na telefonu se navigace schová do menu pod avatarem.
- **Vpravo (přihlášený s profilem):** avatar + přezdívka + šipka → rozbalovací menu: hlavička s přezdívkou, „Změnit avatar“, „Přepnout profil“, „Účet rodiče“, „Odhlásit“. Ovladatelné klávesnicí (Esc zavře, fokus se vrací na spouštěč), na dotyk velké cíle.
- **Vpravo (přihlášený bez profilu):** „Vybrat profil“ + „Účet rodiče“.
- **Vpravo (anonym):** „Přihlásit“ + amber „Zkusit zdarma“ mimo lekci (dnešní `HeaderCta` pravidlo: v lekci se amber v hlavičce neukazuje).

`/` a právní stránky si mohou ponechat světlou `PublicHeader`, ale **její logo a pravá strana musí být session-aware** (přihlášenému „Do učebny“ místo „Přihlásit“). Ponechat dvě hlavičky je povolené, pokud se chovají stejně; rozhodnutí je na implementaci (§11).

### 4.3 Rodičovská zóna

Do hlavičky `/ucet` přibude odkaz „Do učebny →“ (na `/ucim-se`). Nic dalšího se tam nemění.

## 5. Lobby (`/ucim-se`)

Viz náhled `lobby-kombinace.html`. Shora dolů:

### 5.1 Hlavní plocha (hero)

Tmavý gradient (indigo-950 → ink → cyan-950, 135°), velké průhledné W (logo, ~10 % opacity) přes pravou polovinu. Tři sloupce na desktopu, na telefonu pod sebou v pořadí: věta + tlačítko → karta lekce → dítě.

1. **Dítě:** avatar ve velkém kruhu s cyan prstencem, přezdívka, pod tím tři čísla, která aplikace opravdu má: hotové lekce, postavené obvody (= počet hotových lekcí, viz §9.3 — ne počet řádků v `projects`), certifikáty. Žádný titul („Začínající konstruktér“ z náhledu je mimo rozsah).
2. **Věta a akce:** mono štítek „Kurz IoT · lekce 4 ze 7“, nadpis o dvou řádcích s druhou půlkou v cyan („Vítej zpátky. / Semafor *čeká na dráty.*“), jedna věta o tom, kde dítě skončilo, a **jediné amber tlačítko „Pokračovat v lekci →“**.
3. **Karta rozdělané lekce:** malý náhled (obrázek lekce nebo její obvod), štítek „Rozdělaná práce“, název, čtyřdílný ukazatel kroků lekce (Zadání · Součástky · Zapojení · Program) s vyznačeným krokem.

**Stavy hero:**

| Stav | Nadpis / věta | Tlačítko | Karta |
|---|---|---|---|
| Nic hotového, žádný koncept | „Ahoj {nick}. / Postavíme první *obvod?*“ | „Začít první lekcí →“ | lekce 1, bez ukazatele |
| Další lekce bez konceptu | „Vítej zpátky. / Na řadě je *{lekce}.*“ | „Pokračovat v lekci →“ | lekce, ukazatel na 0 |
| Další lekce s konceptem | „Vítej zpátky. / {lekce} *{věta podle kroku}.*“ | „Pokračovat, kde jsi skončil →“ | lekce, ukazatel podle konceptu |
| Kurz hotový | „Kurz IoT máš *hotový.*“ | „Prohlédnout certifikát →“ (do sbírky) | mini certifikát místo lekce |

Věty pro jednotlivé lekce a kroky („čeká na dráty“, „čeká na program“) patří do obsahu lekce, ne do komponenty (§10.1).

**Kde dítě skončilo** se pozná ze dvou zdrojů: server ví, které lekce jsou hotové (`progress`), prohlížeč ví o konceptu (`lessons/draft.ts`). Hero se vykreslí na serveru s „další lekcí“ a po připojení se na klientovi upřesní podle konceptu — bez poskočení layoutu (karta má pevnou výšku, mění se jen text a ukazatel). Odhad kroku z konceptu: obvod se liší od výchozího → aspoň „Zapojení“; zapojení je kompletní (`checkWiring`) a kód/bloky se liší od startovních → „Program“.

„Pokračovat, kde jsi skončil“ musí v lekci rovnou otevřít krok z konceptu (dnes lekce koncept nabídne až v kroku Zadání tlačítkem „Pokračovat, kde jsem skončil“). Způsob předání je na implementaci (např. `?pokracovat=1`).

### 5.2 Mapa cesty

Na světlém papíru pod hero. Štítek „Tvoje cesta kurzem {název}“ + „3 / 7 hotovo“. Sedm uzlů v řadě spojených čárou: hotové zeleně s fajfkou, aktuální amber, větší, s tvrdým stínem a popiskem „právě tady“, budoucí bílé s časem lekce, poslední tmavý s hvězdou a popiskem „→ certifikát“. Čára je až k aktuálnímu uzlu plná zelená, dál čárkovaná.

- Každý uzel je odkaz na lekci (i hotové — zopakovat). Žádné zamykání: hotové pořadí je doporučení, ne zámek (dnešní pravidlo „N8“ v `/ucim-se`).
- Na telefonu svisle.
- Lekce `is_published = false` se v mapě neukazují (v přehledu kurzu ano, jako „připravujeme“ — tam zůstává).
- Seznam lekcí a kurz se berou z DB, ne napevno. Lobby dnes čte jen kurz `iot`; má se to dát rozšířit na „kurz, ve kterém dítě naposledy pracovalo“, ale s jedním kurzem to stačí řešit jako `iot`.

### 5.3 Spodní řada — tři stejné sekce

Tři sloupce stejné šířky a výšky, každý se štítkem nahoře a odkazem dole. Na telefonu pod sebou.

1. **Co jsi postavil:** až čtyři poslední výtvory jako malé náhledy (§9) s názvem lekce; prázdné místo s přerušovaným rámečkem „tady bude tvůj {další lekce}“. Odkaz „Celá sbírka →“.
2. **Certifikát:** zmenšenina A4 na šířku (dnešní `CertificateCard` náhled jako výchozí bod) — před dokončením kurzu vybledlá se zámkem „po lekci 7“, po dokončení plná a klikací (otevře PDF).
3. **Léto:** tmavá karta s W v rohu, „Tohle všechno naživo“ a jedna věta, odkaz „Prohlédnout tábor →“. Pravidla v §8. Když tábor ukázat nejde, místo něj… (§11, otázka pro stavitele: třetí sekci nahradit, nebo řadu zúžit na dvě).

## 6. Oslavy

### 6.1 Po běžné lekci

Nahrazuje dnešní obrazovku `completed` v `LessonRunner` pro lekce, které nejsou poslední v kurzu. Viz spodní část `finale.html`.

- Levá půlka tmavý gradient s W: štítek „✓ Lekce 4 hotová“, nadpis s cyan dovětkem („Semafor *jede.*“), věta o tom, co dítě postavilo, a „Přidáno do tvé sbírky.“ (jen když se uložilo), mini mapa kurzu.
- Pravá půlka: karta „Další na řadě · lekce 5“ s názvem, jednou větou a časem, tlačítka amber „Další lekce →“ a „Do lobby“.
- Konfety (dnešní `Celebration`) při zobrazení.
- **Zůstává** všechno, co dnes `completed` obrazovka řeší: varování `needsChildProfile` s odkazem `?zapsat=`, zeď pro anonyma („Ulož si to“) — zeď se přesune do pravé půlky místo karty další lekce a „Další lekce“ zůstane jako sekundární tlačítko (dítě nesmí uvíznout, pravidlo projektu).

### 6.2 Finále kurzu (poslední lekce)

Celá šířka pod hlavičkou, viz `finale.html`.

- **Hero:** tmavý gradient s radiálním cyan zářením, W vlevo dole. Vlevo štítek „★ Kurz dokončen“, nadpis „{Nick}, / jsi *konstruktér.*“ (oslovení v 5. pádě — viz §11), věta o kurzu, čísla (lekce, obvody), tlačítka amber „Stáhnout certifikát ↓“ a obrysové „Zpět do lobby“.
- **Vpravo certifikát** (§6.3).
- **Pod tím dvě stejné karty:** „Co dál“ (řada malých náhledů postavených obvodů, odkaz do sbírky, věta „Další kurz chystáme — až bude hotový, ukáže se tady i v lobby“) a tábor (§8).
- Konfety ve dvou vlnách: při zobrazení a ve chvíli, kdy certifikát dopadne.

### 6.3 Certifikát ve 3D

Kvalita je tu požadavek, ne bonus. Certifikát je HTML/CSS (ne PDF v iframe — CSP `frame-ancestors`/`object-src` to stejně nedovolí), stejná data jako PDF (`CertificateData` z `features/certificates/document.ts`), ať se nerozejdou.

- **Přílet:** z dálky a natočení (translateY, rotateX ~40°, rotateY ~−30°, scale 0.7) do klidové polohy (rotateX 6°, rotateY −12°) s mírným přestřelem, ~1 s, se zpožděním po nadpisu.
- **Náklon za myší:** `perspective` na rodiči, rotace podle polohy kurzoru (±11° X, ±13° Y), lehké zvětšení; plynulé (pružina nebo interpolace v `requestAnimationFrame`, ne skoky po `mousemove`); po opuštění návrat do klidové polohy.
- **Hloubka:** vrstvy uvnitř na různých `translateZ` (text, pečeť „7/7 lekcí“ nejvýš), aby náklon měl paralaxu.
- **Odlesk:** lesklý pruh, jehož úhel a poloha sledují kurzor (blend soft-light), viditelný jen při interakci.
- **Dotyk / bez myši:** jemné samovolné pohupování (několik stupňů, pomalý cyklus); na zařízení s gyroskopem volitelně náklon podle naklonění telefonu, jen pokud to nevyžaduje dialog s oprávněním (iOS ho vyžaduje → tam jen pohupování).
- **Omezit animace:** certifikát rovnou v klidové poloze, bez náklonu, bez odlesku, bez konfet.
- **Výkon:** jen `transform`/`opacity`, `will-change` jen během interakce; 60 fps na průměrném notebooku.
- **Klik / klávesnice:** certifikát je dekorace (`aria-hidden`), skutečná akce je tlačítko „Stáhnout certifikát“.
- Vzhled: papír, ink rámeček, amber tvrdý stín, W v rohu (~13 %), „Weeks UČEBNA“ s logem, „Certifikát“, jméno velkým písmem, „za dokončení kurzu“, název kurzu, patička „Dokončeno {datum} · projekt {projekt}“ a „Weeks s.r.o.“, amber pečeť „7 / 7 lekcí“.

**Stáhnout certifikát:** odkaz na dnešní `GET /ucet/certifikat/{childId}/{kurz}/` (otevře PDF). Route ověřuje přihlášení a vlastnictví profilu — dítě je přihlášené přes rodiče, takže funguje. Certifikát se počítá z `progress` (`earnedCertificates`), a protože se ukládá asynchronně, tlačítko musí počkat, až je postup lekce 7 opravdu zapsaný (ne odkazovat na 404).

### 6.4 Finále bez účtu (R5)

Stejné finále. Rozdíly:

- Na certifikátu místo jména „Tvoje jméno“ (stejným písmem, lehce vybledlé), pečeť zůstává.
- Hlavní amber tlačítko „Ulož si postup a získej certifikát“ → `/registrace` (stejné měření jako dnešní `CourseEndWall`: `signup_start`). Sekundárně „Zpět na přehled kurzu“.
- Karta „Co dál“ místo sbírky vysvětlí, že postup je jen v tomhle prohlížeči (dnešní text zdi).
- Tábor stejně jako přihlášenému (§8), bez regionu.

### 6.5 Analytika

Dnešní události zůstávají beze změny (`lesson_complete`, `course_complete`, `signup_prompt_view`, `signup_start`, `camp_cta_click`). Nové `placement` hodnoty pro `camp_cta_click` / UTM `utm_content`: `lobby`, `finale`, `finale-anonym`. Nová událost jen pokud je potřeba pro rozhodování — návrh: žádná.

### 6.6 Anonym a „lobby bez účtu“

Anonym nemá `/ucim-se` (je chráněná). Jeho domov je `/kurz/iot`: když má v anonymní relaci aspoň jednu hotovou lekci, horní část stránky přehledu kurzu se vykreslí jako lobby hero (bez avataru a čísel, s „Pokračovat“ a kartou lekce podle konceptu) a pod ní mapa cesty; místo spodní řady jedna karta „Ulož si postup“ (registrace) a tábor. Bez postupu zůstává dnešní přehled kurzu. Vykresluje se na klientovi z localStorage (dnes to `CourseOutlineList` dělá taky); server pošle výchozí verzi bez postupu.

## 7. Konec lekce — co se v kódu mění

- `LessonRunner` `completed` větev se rozdělí na `LessonDone` (§6.1), `CourseFinale` (§6.2) a `CourseFinaleAnon` (§6.4). Dnešní `CourseEndWall` zaniká ve `CourseFinaleAnon`.
- „Je to poslední lekce kurzu“ = kurz je po této lekci celý hotový (union server + relace + tahle lekce, stejné pravidlo jako `course_complete`), **ne** „nemá další lekci“. Kdo skočil rovnou na lekci 7, dostane malou oslavu a v ní, kolik lekcí mu chybí.
- Hotová lekce se uloží do sbírky (§9) ve stejném okamžiku jako postup.
- Hlavička lekce: pruh „Učí se {nick} · Přepnout“ zůstává (dnes pod drobečkovou navigací) — dítě v lekci má vědět, čí postup se zapisuje. Drobečková navigace „← Kurz“ míří do lobby pro přihlášené a na `/kurz/iot` pro anonyma.

## 8. Tábor uvnitř aplikace

- Zdroj pravdy o termínech, cenách a stavu je weeks.cz (`weeks_web/src/lib/turnusy.ts`). Učebna **neopisuje data ani ceny** — jen město a to, jestli se dá přihlásit (`src/lib/camp-offer.ts`, `CAMP_CITIES[*].prihlasky`). Stejné pravidlo jako dnes.
- Kdy se ukazuje: rodič má kraj v táborovém spádu (`segmentForRegion` → `camp`) a pro jeho město `prihlasky: true` → karta s odkazem na `weeks.cz/tabory?mesto=…` (`campUrl`). Spád bez otevřených přihlášek → karta s „dát mi vědět“ (dnešní `waitlist` segment). Mimo spád → karta se neukazuje (§11). Anonym (bez kraje) → obecná karta na `weeks.cz/tabory`, pokud aspoň jedno město má `prihlasky: true`.
- `prihlasky` je ruční přepínač a zůstává ruční (návrh dokumentu, ne rozhodnutí zakladatele): synchronizace napříč repozitáři by stála víc, než kolik termínů se za rok otevře. Kdo otevře nebo zavře turnus na weeks.cz, přepne i tenhle příznak — implementace to připíše do komentáře u `CAMP_CITIES` a do postupu „When another turnus is confirmed“ v `weeks_web/CLAUDE.md`. Karta proto nesmí tvrdit nic, co by při zastaralém příznaku lhalo hůř než „podívej se na termíny“ (viz text níž).
- Text karty bez čísel, která by mohla zastarat: „Tohle všechno naživo — příměstský tábor v {Karlových Varech}, skutečné Arduino a 3D tisk.“ Žádné datum, žádná cena, žádný počet míst.
- Vizuál podle „dílny“ (R1): ink, W v pravém dolním rohu (~25 %), amber štítek „Léto 2027“, amber odkaz. Odkaz v nové kartě, `camp_cta_click` s `placement`.
- Komponenta má být jedna (`CampCta` dnes renderuje `DarkSection` pro `/ucet`); lobby, finále i `/ucet` z ní mají brát stejný obsah, vzhled se smí lišit velikostí.

## 9. Sbírka

### 9.1 Co se ukládá

Při vyřešení lekce (dnes `onSolved` v `LessonWorkbench`, kde se maže koncept) se uloží výtvor: obvod (`Circuit`), kód, bloky (pokud režim bloků), režim. Pro přihlášené dítě do tabulky `projects` (existuje od migrace 001, RLS pro vlastníka v 002, dnes nepoužívaná): `kind = 'circuit'`, `child_id`, `lesson_id`, `title` = název lekce, `data` = `{circuit, code, blocks?, mode}`. Jeden výtvor na dítě a lekci — opakované vyřešení přepíše starý (unikátní index `(child_id, lesson_id, kind)` novou migrací). Zápis serverovou akcí stejnou cestou jako postup (ověří, že profil patří přihlášenému rodiči), neblokuje oslavu.

Pro anonyma se výtvor uloží do anonymní relace (`anon-session`, nová položka u lekce; verze schématu se zvedne) a při převzetí postupu do účtu (dnešní adopce) se přenese spolu s ním. Velikost: obvod lekce 7 je řádově jednotky kB, sedm lekcí se do localStorage vejde.

### 9.2 Stránka sbírky

`/ucim-se/sbirka`: nahoře certifikáty (plná zmenšenina s odkazem na PDF, nebo zamčená), pod tím mřížka výtvorů v pořadí lekcí — náhled obvodu, název lekce, datum. Klik → `/ucim-se/sbirka/[lekce]`: velký náhled obvodu jen ke čtení (bez přehrávání nebo s „Spustit“ — §11), program jen ke čtení (kód nebo bloky podle režimu), „Otevřít lekci znovu“.

### 9.3 Hotové lekce bez uloženého výtvoru

Všechno hotové před nasazením (a lekce převzaté ze starších anonymních relací) výtvor nemá. Sbírka je přesto ukáže: náhled se vykreslí ze **vzorového zapojení lekce** (`referenceCircuit(lesson.wiring)`) a detail nabídne „Otevřít lekci znovu“ místo programu, s drobným štítkem „vzorové zapojení“. Počet „obvodů“ v hero = počet hotových lekcí, ne počet řádků v `projects`.

### 9.4 Náhledy

Náhled obvodu se kreslí stejnými součástkami jako lekce (wokwi elementy přes `CircuitBuilder` jen ke čtení), aby výtvor vypadal jako to, co dítě postavilo. V lobby jsou čtyři, ve sbírce až sedm na kurz — implementace musí ohlídat, že se stránka nezadrhne (líné vykreslení, `IntersectionObserver`, případně statický snímek). Pole `thumbnail` v `projects` je k dispozici, pokud se ukáže, že živý náhled je moc drahý.

## 10. Avatar

`/ucim-se/avatar`: mřížka avatarů (dnešní sada 8 kreslených SVG v `children/avatars.tsx` — robot, raketa, blesk, žárovka, ozubené kolo, mikroskop, obvod, planeta), aktuální vyznačený, klik uloží a vrátí do lobby. Zápis přes existující `updateChildAction` (dnes nevolaný) nebo úzkou akci jen na avatar; ověření, že profil patří přihlášenému rodiči, stejné jako u přepnutí profilu. Avatar se ukazuje v hlavičce, v hero lobby a na výběru profilu. Sada se nemění (zvířecí PNG v `public/avatars` patří starému kiosku).

V hero se avatar ukazuje velký (~116 px) v kruhu s cyan prstencem na tmavém pozadí; SVG avatary jsou dnes kreslené pro světlé pozadí (`text-ink`) — v hero se vykreslí na světlém kruhu uvnitř prstence, ne přímo na gradient.

### 10.1 Obsah lekcí

Do `Lesson` (`features/lessons/types.ts`) přibudou krátké texty pro lobby a oslavu, ať komponenty nemají text napevno:

- `doneTitle` — dovětek nadpisu oslavy („jede.“ k „Semafor“), `doneLine` — jedna věta o tom, co dítě postavilo;
- `waiting` — dovětek pro lobby podle kroku (`wiring`: „čeká na dráty.“, `code`: „čeká na program.“, `start`: „je na řadě.“) — může být společný default s možností přepsat;
- `teaser` — jedna věta pro kartu „Další na řadě“ (dnes je k dispozici `summary` z DB, stačí-li).

Texty napíše implementace pro všech sedm lekcí; Lukáš je zreviduje při kontrole (vykání rodičům, tykání dětem — dětská část tyká).

## 11. Na implementaci (rozhodne stavitel, zapíše do plánu)

- Všechna čísla lekcí v textech („lekce 4 ze 7“, „7 / 7 lekcí“, „po lekci 7“) se odvozují z počtu publikovaných lekcí kurzu, nikde nejsou napevno. Sedmička v tomto dokumentu je jen dnešní stav.

- Jedna hlavička pro všechno, nebo `AppHeader` + session-aware `PublicHeader` (§4.2).
- Jak předat „pokračovat od kroku“ do lekce (§5.1).
- Animace: CSS + malý vlastní kód, nebo `framer-motion` (je v závislostech, mimo starý kiosk nepoužívaný). Nová knihovna jen s důvodem.
- Tvar dat a klíče pro anonymní výtvory (§9.1); migrace unikátního indexu na `projects`.
- Jestli detail výtvoru umí „Spustit“ (přehrát simulaci), nebo je jen statický.
- Oslovení v 5. pádě („Lukáši“): spolehlivě z přezdívky nejde (přezdívky jsou cokoli). Výchozí volba: nadpis bez oslovení v 5. pádě — „{Nick} je *konstruktér.*“, případně „Kurz máš za sebou, {nick}.“ Stavitel vybere formulaci, která funguje pro libovolnou přezdívku.
- Třetí sekce lobby, když tábor ukázat nejde (§5.3, §8).
- Klíč konceptu je dnes jen podle lekce (`weeks.lesson-draft.v1.<lekce>`), ne podle profilu — sourozenci na jednom počítači by v lobby viděli cizí „rozdělanou práci“. Doporučení: klíčovat podle profilu (a pro anonyma ponechat dnešní klíč), s migrací stávajících konceptů na aktivní profil.

## 12. Ověření

- Jednotkové testy pro: výpočet stavu hero (tabulka §5.1), odhad kroku z konceptu, „je kurz hotový“ pro finále, pravidla zobrazení tábora, ukládání a přepis výtvoru, převzetí anonymních výtvorů.
- Komponentní testy stylem projektu (`renderToStaticMarkup` + asserty) pro hlavičku ve třech stavech (anonym / bez profilu / s profilem) a pro lobby ve čtyřech stavech hero.
- E2E (Playwright, `e2e/`): anonym projde lekci → malá oslava → logo vede na `/kurz/iot`; přihlášený → lobby → „Pokračovat“ otevře lekci → menu → účet rodiče → „Do učebny“.
- Ruční kontrola v prohlížeči na 1366×768 a 390×844: lobby nad ohybem ukazuje „Pokračovat“ na obou; finále s náklonem certifikátu; „omezit animace“ zapnuté.
- `tsc`, celý `vitest`, `next build` zelené před každým pushem; `main` = produkce.
