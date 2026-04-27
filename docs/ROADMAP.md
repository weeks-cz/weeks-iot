# Weeks Learning App — Roadmap & Strategie

> Živý dokument. Aktualizováno: 2026-04-27 (Fáze 0 dokončena).  
> Autoři: Lukáš, Štěpán, Kryštof

---

## Kde jsme teď

Appka má solidní základ — gamifikace, témata, avatary, styly, denní výzvy, admin panel. Ale je navržená jako **lokální táborová pomůcka** (localStorage, PIN auth), ne jako veřejný produkt. To je v pořádku — tohle je přesně správné stadium pro první tábor.

**Celkové hodnocení pro tábor:** 7/10 — funkční, ale chybí pár věcí které na živém táboře budou bolet.

---

## Fáze 0 — Tábor ✅ HOTOVO (2026-04-27)

**Cíl:** Appka funguje bez problémů na táboře s 10–20 dětmi. Lektor ji zvládne spravovat. Neztrácíme data.

### Kritické

| Co | Stav | Soubor |
|----|------|--------|
| "Reset studenta" v admin panelu | ✅ commit `009ca74` | `src/app/admin/page.tsx` |
| Lektor view — přehled pokroku studenta | ✅ statistika sidebar v adminu | `src/app/admin/page.tsx` |
| `adminPreviewActive` reset v `loadGameState` | ✅ commit `009ca74` | `src/lib/storage.ts` |
| Loading state pro validaci kódu | ✅ commit `009ca74` | `src/components/task/CodeValidator.tsx` |
| Tooltip na disabled Help tlačítka | ✅ commit `009ca74` | `src/components/task/HelpCards.tsx` |
| localStorage quota error handling | ✅ storage banner v provideru | `src/lib/storage.ts` + GameStateProvider |
| PINy přesunout do .env | ✅ commit `5118415` — `NEXT_PUBLIC_*` s fallbackem | `src/lib/config.ts` |
| Mobile sidebar — collapsed view | ✅ daily-challenge strip pod hlavičkou | `src/components/screens/TaskList.tsx` |

> Poznámka: `NEXT_PUBLIC_*` PINy stejně skončí v JS bundlu. Benefit je rotace
> a že produkční hodnoty nejsou v gitu. Admin panel ukazuje červený banner,
> dokud běží na fallback hodnotách.

### Doporučené

| Co | Stav |
|----|------|
| Lepší onboarding pro nového studenta | ✅ Welcome modal — vysvětlí ⭐, denní výzvu |
| Zobrazit PIN studentovi po přihlášení | ✅ "Student N" v hlavičce + ve welcome modalu |
| Offline banner | ✅ `navigator.onLine` + online/offline events |
| Zmenšit textarea na mobilu | ✅ rows 10→8 |

### Co záměrně nedělat před táborem

- Neřešit databázi / real auth — je to zbytečná komplexita pro lokální nasazení
- Neřešit platby
- Nespouštět veřejně — nejdřív ověřit na táboře

---

## Fáze 1 — Veřejná beta (2–4 měsíce po prvním táboře)

**Cíl:** Appka je přístupná veřejnosti pod `learn.weeks.cz`. Freemium model. První platící uživatelé.

**Kdy spustit:** Až budete mít alespoň 20–30 reálných uživatelů z tábora, zpětnou vazbu, a víte co musíte opravit. Unáhlené veřejné spuštění s nedodělanou appkou je horší než žádné.

### Technické kroky (v pořadí)

#### 1. Databáze a auth (největší změna)
- Nahradit localStorage za **Supabase** (free tier stačí na začátek)
- Supabase Auth pro uživatelské účty (email + password, nebo magic link)
- Data studentů přesunout na server — tahle změna odblokuje vše ostatní
- Zachovat PIN systém pro tábory jako "guest mode"
- **Odhadovaná práce:** 2–3 víkendy vibecoding

#### 2. Platební systém
- **Stripe** — nejjednodušší integrace, funguje v CZ
- Freemium model (viz níže)
- Webhook pro aktivaci prémiového přístupu
- **Odhadovaná práce:** 1 víkend

#### 3. Landing page
- Separátní stránka `learn.weeks.cz` nebo `weeks.cz/learn`
- Vysvětlí co appka je, pro koho, kolik stojí
- CTA: "Vyzkoušet zdarma"
- Neodkazovat na DDM, čistě Weeks brand
- **Odhadovaná práce:** 1 víkend vibecoding

#### 4. Základní analytika
- **Posthog** nebo Vercel Analytics (oba mají free tier)
- Měřit: registrace, aktivní uživatelé, dokončené úkoly, kde se odchází
- Bez dat nevíte co opravit
- **Odhadovaná práce:** pár hodin

#### 5. Email sekvence
- Welcome email po registraci
- "Vrať se" email pokud nenavštíví 7 dní
- Využít stávající Resend integraci, jen rozšířit
- **Odhadovaná práce:** 1 víkend

### Freemium model — konkrétní návrh

```
FREE (navždy zdarma):
  ✓ Celý IoT modul — Začátečník
  ✓ Gamifikace (hvězdičky, odznaky, avatary — základní)
  ✓ Denní výzvy
  ✗ Pokročilý a Expert sekce
  ✗ Ostatní moduly (3D tisk, programování, Blender)
  ✗ Premium avatary a styly

STUDENT (79 Kč/měs nebo 699 Kč/rok):
  ✓ Vše z free
  ✓ Všechny sekce ve všech modulech
  ✓ Veškerý obsah prémiových shopů
  ✓ Progress export / sdílení

ŠKOLA (na dotaz, ~3 000–8 000 Kč/rok za třídu):
  ✓ Vše pro studenty (hromadné licence)
  ✓ Teacher dashboard — přehled celé třídy
  ✓ Vlastní branding (logo školy v appce)
  ✓ Prioritní podpora
```

**Proč tenhle model:**
- Free IoT Začátečník je dost obsahu na to, aby dítě strávilo týdny a poznalo hodnotu
- Cena 699 Kč/rok je méně než jeden kroužek — argument pro rodiče
- Školy platí rádi za "hotové řešení" — Kryštof to může prodávat při svém školním outreachu

---

## Fáze 2 — Produkce (6–12 měsíců)

**Cíl:** Stabilní příjem, B2B školy, více modulů, připravenost pro investory.

### Klíčové milníky

| Milník | Kdy | Co dokazuje |
|--------|-----|-------------|
| 100 registrovaných uživatelů | M+3 | Produkt má zájem |
| 10 platících uživatelů | M+4 | Willingness to pay |
| 1 školní licence | M+6 | B2B funguje |
| 500 uživatelů | M+9 | Škálovatelnost |
| 2. modul (programování) | M+6 | Platforma, ne single-module tool |

### Kdy jít za Pavlem Chmátalem

Až budete mít: **aktivní uživatele + alespoň 1 platícího zákazníka + 2 moduly**. Tehdy máte co ukázat — ne jen nápad, ale produkt s trakcí. Typický advisory deal: 1–3 % equity za konkrétní deliverables (investor intro, pitch deck, mentoring). Nepodepisujte nic otevřeného jako "equity za pomoc obecně."

### Technické priority Fáze 2

- CMS pro přidávání úkolů bez editace kódu (Contentlayer nebo custom admin)
- Teacher dashboard pro školy
- iOS/Android wrapper (React Native nebo Capacitor — reuse React kódu)
- Vícejazyčnost (angličtina) — ne dříve než budete saturovat CZ/SK trh

---

## Architektura účtů — jak to řešit

### Teď (tábor): PIN + localStorage ✓
Funguje dobře pro tábor. Každý student = číslo 1–N. Data jsou na zařízení. Pro 3hodinový tábor na jednom místě je to dostačující.

**Jediný problém:** Sdílený tablet → studenti vidí data ostatních v localStorage. Pro tábor to není kritické (lektor u toho je), pro produkci by bylo.

### Přechodná fáze (beta): Supabase Auth + DB
```
Uživatel registruje email + heslo (nebo magic link)
  → Supabase vytvoří účet
  → Progress se ukládá na server, ne localStorage
  → Tábor "guest mode" zůstane jako je (PIN + localStorage)
  → Uživatel může pokračovat na jakémkoli zařízení
```

Supabase free tier: 500 MB databáze, 50 000 MAU — na rok+ stačí.

### Produkce: Multi-tenant
- Školy jako "organizace" s více studenty
- Teacher = admin v rámci organizace
- Student = člen organizace
- Přesně jak to dělají platformy jako Classcraft nebo Gimkit

---

## Kdy otevřít veřejnosti

**Doporučení: Soft launch po prvním táboře, ne dříve.**

Postup:
1. **Tábor** → sbíráte zpětnou vazbu, opravujete chyby
2. **2 týdny po táboře** → opravte top 3 problémy z feedback
3. **Soft launch** → share na sociálních sítích Weeks, odkaz z weeks.cz
4. **Bez paywallu první měsíc** → chcete uživatele, ne revenue
5. **Po 50–100 uživatelích** → spusťte prémiové předplatné

**Proč ne hned:** Špatný první dojem je horší než žádný. Pokud první děti přijdou a appka má bugy, nepřijdou znovu. Jeden tábor vám dá reálný stress-test který žádné testování nenahradí.

---

## Marketing s malým budgetem

S 1–2 tis. Kč/měsíc nemá smysl dělat placenou reklamu — je to příliš malé na to, aby dávalo měřitelné výsledky. Místo toho:

**Co funguje lépe:**
- **SEO** — napsat pár článků "Jak začít s Arduinem pro děti" → organická návštěvnost
- **Školy** — Kryštof pokračuje v outreachu, zmíní appku jako free resource
- **Rodiče** — Facebook skupiny pro rodiče s IT dětmi (Děti a technika, Programování pro děti CZ)
- **Tábory jako akviziční kanál** — každé dítě z tábora = potenciální platící uživatel appky
- **YouTube/Shorts** — krátká videa "Udělej semafor s Arduinem za 10 minut"

**Cílení reklam (až bude budget):**
- Meta Ads, cílení na rodiče 30–45 let, CZ+SK, zájem: vzdělávání, technologie, děti
- Google Ads na klíčová slova: "arduino pro děti", "programování pro děti online", "iot kurz pro mladé"

---

## Otevřené otázky (rozhodnutí která musíte udělat)

- [ ] **Doména:** `learn.weeks.cz` nebo samostatná `weekslearn.cz`?
- [ ] **Název produktu:** "Weeks App", "Weeks Learning", nebo jinak?
- [ ] **Equity split:** Jak je rozdělen Weeks obecně? Je to formalizované?
- [ ] **IČO:** Appka pojede na čím IČO? Lukášově?
- [ ] **Obsah modulů:** Kdo bude psát nové úkoly? Štěpán?
- [ ] **B2B kontrakty:** Má Kryštof spojení na konkrétní školy které by to mohly vzít?

---

## Stav na dnešek (2026-04-27)

```
✅ Hotovo (Fáze 0 dokončena)
  - IoT modul (31 úkolů, 3 sekce)
  - Gamifikace (hvězdičky, tokeny, odznaky, avatary, styly)
  - Multi-student systém (PIN + student number, per-student data)
  - Admin panel (statistiky, nastavení, reset jednotlivého studenta)
  - Daily challenge (auto-award při splnění)
  - Code drafts persistence, prev/next navigace mezi úkoly
  - Téma selector (IoT, 3D tisk, programování, Blender — jen IoT enabled)
  - Welcome modal pro první přihlášení
  - Storage failure + offline bannery
  - PINy z env s fallbackem (`NEXT_PUBLIC_DAILY_PIN` apod.)
  - Email systém (Resend) — funkční, čeká na produkční test

🎯 Další krok: PRVNÍ TÁBOR (~mid-May 2026)
  Sbírat reálnou zpětnou vazbu, ne další dev. Po táboře 2 týdny na top 3 bugy.

❌ Chybí (pro veřejnou beta — Fáze 1)
  - Databáze + real auth (Supabase)
  - Platební systém (Stripe)
  - Landing page (`learn.weeks.cz`)
  - Analytika (Posthog / Vercel)
  - 2+ moduly
  - Vyřešit otevřené otázky výše (doména, název, IČO, equity split)
```
