# Weeks Learning App — Roadmap & Strategie

> Živý dokument. Aktualizováno: 2026-04-27 (Fáze 1 dokončena).  
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

## Fáze 1 — Email auth + cloud sync ✅ HOTOVO (2026-04-27)

**Cíl:** Studenti si mohou vytvořit účet emailem a pokračovat doma na vlastním počítači.

### Co bylo postaveno

| Co | Stav | Commits |
|----|------|---------|
| Supabase projekt (eu-central-1, email confirm off, Resend SMTP) | ✅ | manuální setup |
| DB migrace — `learning_accounts` + `learning_events` + RLS + GRANTs | ✅ | `b09efa4` |
| Email auth v PinEntry — 3 taby (přihlásit / vytvořit / magic link) | ✅ | `0c00f09..0b65128` |
| Cloud hydration — `CLOUD_HYDRATE` action (stale-closure safe) | ✅ | `0c00f09` |
| Debounced cloud push + beforeunload flush | ✅ | `f57407a` |
| Learning events emise z reducerů | ✅ | `18f85aa` |
| `Propojit účet` modal v TaskList sidebaru | ✅ | `0b65128` |
| weeks-hub: IoT service-role klient + `/admin/learning` stats | ✅ | `ac09e32` |
| weeks-hub: `/admin/learning/users` tabulka | ✅ | `4dc1554` |
| UX audit + opravy (badge scroll, email label, PIN cleanup) | ✅ | `ee499ac` |
| Singleton Supabase klient (fix auth event propagation) | ✅ | `18fea2e` |
| Nickname seedování z user_metadata | ✅ | `18fea2e` |

### Architektura
- **localStorage = cache, Supabase = truth** pro linked users
- Push-after-link: při prvním propojení se pushne stávající progress do cloudu
- PIN systém pro tábory zůstává beze změny (guest mode)
- Viz `docs/superpowers/specs/2026-04-27-supabase-migration-design.md` pro detaily

---

## Fáze 2 — Platební systém (po prvním táboře)

**Cíl:** Appka je přístupná veřejnosti pod `iot.weeks.cz` s freemium modelem. První platící uživatelé.

**Kdy spustit:** Po prvním táboře (~mid-May 2026) a opravení top 3 feedback bugů. Unáhlené veřejné spuštění s nedodělanou appkou je horší než žádné.

### Technické kroky (v pořadí)

#### 1. Platební systém
- **Stripe** — nejjednodušší integrace, funguje v CZ
- Freemium model (viz níže) — zamknout Pokročilý/Expert za paywall
- Webhook pro aktivaci prémiového přístupu → zápis do `learning_accounts.plan`
- **Odhadovaná práce:** 1 víkend

#### 2. Landing page
- Separátní stránka nebo úprava `iot.weeks.cz` homepage
- Vysvětlí co appka je, pro koho, kolik stojí
- CTA: "Vyzkoušet zdarma"
- Neodkazovat na DDM, čistě Weeks brand
- **Odhadovaná práce:** 1 víkend

#### 3. Základní analytika
- **Posthog** nebo Vercel Analytics (oba mají free tier)
- Měřit: registrace, aktivní uživatelé, dokončené úkoly, kde se odchází
- Bez dat nevíte co opravit
- **Odhadovaná práce:** pár hodin

#### 4. Email sekvence
- Welcome email po registraci (zatím manuální přes Resend)
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
✅ Hotovo (Fáze 0 + Fáze 1 dokončena)
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
  - Email auth (přihlásit / vytvořit účet / magic link)
  - Cloud sync — Supabase DB, debounced push + beforeunload flush
  - Propojit účet modal (guest → linked přechod za běhu)
  - Cross-device login (přihlásit se na jiném zařízení, progress se načte)
  - weeks-hub admin: /admin/learning — statistiky + tabulka uživatelů
  - Singleton Supabase klient (auth events propagují správně)
  - Nickname seedování z user_metadata při prvním přihlášení

🎯 Další krok: PRVNÍ TÁBOR (~mid-May 2026)
  Sbírat reálnou zpětnou vazbu, ne další dev. Po táboře 2 týdny na top 3 bugy.

❌ Chybí (pro veřejnou beta — Fáze 2)
  - Platební systém (Stripe + freemium paywall)
  - Landing page (`learn.weeks.cz` nebo `iot.weeks.cz` homepage)
  - Analytika (Posthog / Vercel Analytics)
  - 2+ moduly
  - Vyřešit otevřené otázky výše (doména, název, IČO, equity split)
```
