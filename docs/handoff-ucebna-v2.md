# Učebna v2 — stav nasazení

> **Spuštěno 29. 8. 2026 na https://ucebna.weeks.cz** jako preview,
> **v produkci od 29. 9. 2026**: `main` = učebna v2, `iot.weeks.cz`
> přesměrovává 308 na `ucebna.weeks.cz`. Tenhle dokument slouží jako
> záznam konfigurace a jako seznam toho, co zbývá před bránou 19. 10.

## Hotová konfigurace

| Věc | Stav |
|---|---|
| Supabase projekt | `zvfmgizjqozaypyasjru`, Frankfurt, 11 migrací |
| Produkce | `main` (od 29. 9. = učebna v2); stará aplikace je ve větvi `archive/iot-v1` |
| Domény | `ucebna.weeks.cz` → Production; `iot.weeks.cz` → 308 na `ucebna.weeks.cz`; `klicenka.weeks.cz` beze změny (vlastní větev `klicenka`) |
| Proměnné | Production and Preview; `NEXT_PUBLIC_*` jako typ Config (Vercel je jako Secret neuloží). `NEXT_PUBLIC_SITE_URL` jen Production |
| Google OAuth | zapnuto; aplikace publikovaná (29. 9., dřív byla „Testing" s 0 testery = Google login nešel nikomu), branding s odkazy na zásady a podmínky, bez loga (logo = ověření u Googlu) |
| Resend + Auth Hook | zapnuto, magic link ověřen |
| Indexace | `noindex` z `vercel.json` pryč (29. 9.); preview nasazení ho dostávají od Vercelu sama |

**Pozor na anon klíč:** při přepnutí se do Vercelu omylem dostal
`NEXT_PUBLIC_SUPABASE_ANON_KEY` z `.env.local` webu weeks.cz (jiný Supabase
projekt) — produkce pak vracela 404 na všem, co čte databázi. Správný klíč
je z `.env.local` TOHOTO repa. `NEXT_PUBLIC_*` se zapéká při buildu, po
opravě je potřeba redeploy.

## Co ZBÝVÁ před bránou 19. 10.

1. ~~Web je `noindex`~~ — **vyřešeno 29. 9. 2026** přepnutím do produkce.
2. **Google ukazuje `zvfmgizjqozaypyasjru.supabase.co`.** Rodiči, který
   svěřuje data dítěte, to připomíná phishing. Řeší Supabase Custom Domain
   (placený doplněk). Branding v Google Auth Platform vyplněn 29. 9.
3. **Obsah lekce 1** včetně videa z HWLabu — úzké hrdlo celého roku.
4. **Právní revize znění souhlasů** (`src/features/consent/texts.ts`)
   a nových stránek `/ochrana-udaju` a `/podminky` — obojí je návrh,
   otevřené otázky jsou v komentáři na začátku stránek.
5. ~~Potvrdit správce údajů~~ — **vyřešeno 28. 9. 2026**: správcem je
   Weeks s.r.o. (IČO 29984360), souhlasy povýšené na v2. Platby v učebně
   zatím nejsou; až přibudou, prodávající musí sedět s Comgate účtem,
   na který peníze opravdu chodí (s.r.o. zatím vlastní Comgate nemá).
6. ~~Finální doména `ucebna.weeks.cz`~~ — **hotovo 29. 9. 2026**, viz tabulka
   nahoře. Štěpánův feedback se zapracovává až na produkci.
7. **Zalomení drátků** (waypointy u `Wire`) — Lukáš by je v budoucnu chtěl,
   teď se neřeší. Šikmé drátky přes desku řeší umístění u „Zapoj za mě".

## Změny proti Bráně 0, které patří na poradu

- **Bod 10 se mění.** Od 15 let si účet spravuje sám uživatel, ne rodič.
  Nutit patnáctiletého prohlásit „jsem zákonný zástupce" by vyrobilo
  nepravdivý souhlas (§ 7 zák. 110/2019).
- **Ukládá se celé datum narození, ne ročník.** Audit zvolil ročník kvůli
  minimalizaci údajů; platilo to, dokud na věku nezáviselo, kdo smí
  podepsat souhlas.
- **Registrace nemá horní věkovou hranici.** Cílová skupina 10–15 je věc
  měření, ne přístupu — počítá se v `docs/metriky-brana-1.sql`, dotaz 1b.

---

# Referenční postup konfigurace

## 0. Nejdřív si přečti tohle

**V dnešním `.env.local` míří `NEXT_PUBLIC_SUPABASE_URL` (`izrs…`) a `SUPABASE_URL`
(`qtxi…`) na dva různé Supabase projekty.** Server tedy zapisuje jinam, než odkud
čte klient. Nevím, který z nich je ten pravý, a nesahal jsem na to. Zakládáme nový
projekt, takže se to vyřeší samo — ale u staré aplikace na `main` to nejspíš platí
pořád a stojí za kontrolu.

**Správce osobních údajů je v kódu nastavený na Lukáše Kubíka, IČO 24878511.**
Je to jediný právní údaj, který jsem odvodil, ne ověřil: existující zásady Weeks
mají dva správce (DDM Praha 6 pro pražské tábory, Lukáš Kubík pro Karlovy Vary)
a učebna jede podle auditu přes vlastní pokladnu, tedy tu druhou entitu. Potvrď
to, prosím. Změna je jedna konstanta `CONTROLLER` v `src/lib/site.ts`.

**Znění souhlasů jsem napsal celé sám** (`src/features/consent/texts.ts`).
Právní revizi to nenahrazuje. Kdo text změní, musí zvýšit `version` — jinak by
v databázi vznikly dva různé souhlasy pod stejným označením a ledger by přestal
být důkazem.

---

## 1. Supabase projekt

1. Založ nový projekt, region **Frankfurt (eu-central-1)** — údaje dětí mají
   zůstat v EU a zásady to tvrdí.
2. Pusť migrace v tomhle pořadí (SQL Editor, každou zvlášť):

   | Soubor | Co dělá |
   |---|---|
   | `supabase/migrations/001_ucebna_schema.sql` | tabulky, triggery, funkce |
   | `supabase/migrations/002_ucebna_rls.sql` | RLS, sloupcové granty, RPC |
   | `supabase/migrations/003_ucebna_seed.sql` | 14 krajů, kurz IoT, 7 lekcí |
   | `supabase/migrations/004_ucebna_rate_limit.sql` | omezování četnosti |
   | `supabase/migrations/005_ucebna_self_consent.sql` | vlastní souhlas od 15 let |
   | `supabase/migrations/006_ucebna_birth_date.sql` | přesné datum narození |
   | `supabase/migrations/007_ucebna_account_type.sql` | typ účtu (rodič / sám) |

   Nebo naráz přes CLI: `npx supabase link --project-ref <ref>` (v běžném
   terminálu, potřebuje TTY) a pak `npx supabase db push`.

3. Ověř, že to sedlo:

   ```sql
   select count(*) from public.regions;                        -- 14
   select count(*) from public.regions where is_camp_catchment; -- 3
   select count(*) from public.lessons;                        -- 7
   select count(*) from public.lessons where is_published;      -- 1
   ```

4. **Authentication → URL Configuration**
   - Site URL: `https://ucebna.weeks.cz`
   - Redirect URLs: `https://ucebna.weeks.cz/auth/callback`,
     `https://*-lukass-projects-2757878c.vercel.app/auth/callback`
     a `http://localhost:3000/auth/callback`

5. **Authentication → Providers → Email**: nech zapnuté „Confirm email".
   Bez potvrzení adresy nemáme to „přiměřené úsilí k ověření věku", které
   § 7 zák. 110/2019 po správci chce.

> **Migrace 002 je ta důležitá.** Odebírá plošné granty, které Supabase rozdává
> automaticky, a nahrazuje je sloupcovými. Bez ní by klient viděl `pin_hash`
> i sloupce rozhodující o předplatném. Když ji přeskočíš, aplikace bude fungovat
> a bude děravá — přesně ten druh chyby, který se neprojeví.

---

## 2. Google OAuth

1. Google Cloud Console → **Google Auth Platform → Clients → Create client →
   Web application** (dřív se to jmenovalo APIs & Services → Credentials)
2. Authorized redirect URI — přesně tahle jedna adresa, z Supabase, ne z naší
   domény:
   ```
   https://<tvůj-projekt>.supabase.co/auth/v1/callback
   ```
3. **Branding** a **Audience**: typ External, název aplikace, logo a odkazy
   na podmínky i zásady. V **Audience** zkontroluj Publishing status — dokud
   je „Testing", přihlásí se jen ručně přidaní test users.
4. Supabase → **Authentication → Providers → Google**: zapnout, vložit
   Client ID a Client Secret.

---

## 3. Resend a e-maily

Šablony jsou v kódu (`src/lib/email/templates.ts`), Supabase je jen spouští.

1. Resend → **Domains** → přidej `weeks.cz` a nastav DNS záznamy (SPF, DKIM).
   Bez ověřené domény skončí přihlašovací odkazy ve spamu.
2. Vytvoř API klíč s právem `emails:send`.
3. Supabase → **Authentication → Hooks → Send Email Hook**:
   - Enable: ano
   - Type: HTTPS
   - URL: `https://ucebna.weeks.cz/api/auth/email/` — **s koncovým lomítkem**
   - Secret: vygeneruj a ulož — jde do `SUPABASE_AUTH_HOOK_SECRET`

> **To lomítko tam musí být.** Projekt jede s `trailingSlash: true`, takže
> adresa bez něj vrátí 308 (přesměrování) místo 200. Ověřeno naživo: endpoint
> bez lomítka na POST neodpoví. E-maily by tiše přestaly chodit a v Supabase
> by to přitom vypadalo, že hook běží.

> Hook ověřuje podpis Standard Webhooks a bez správného secretu odmítne všechno
> hláškou 401. Je to schválně: endpoint, který rozesílá jednorázové přihlašovací
> tokeny, by bez ověření kdokoli zneužil k doručení odkazu na cizí adresu.

---

## 4. Proměnné prostředí

Do Vercelu (Preview i Production) a do lokálního `.env.local`:

```bash
# Supabase — klient
NEXT_PUBLIC_SUPABASE_URL=https://<projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>

# Supabase — server. NIKDY s prefixem NEXT_PUBLIC_
SUPABASE_URL=https://<projekt>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SUPABASE_AUTH_HOOK_SECRET=<secret z kroku 3>

# E-maily
RESEND_API_KEY=<klíč>
EMAIL_FROM=Weeks Učebna <ucebna@weeks.cz>

# Adresa. Musí být nastavená i na větvi s vlastní doménou — jede přes ni
# nejen kanonický odkaz, ale i emailRedirectTo. Bez ní by potvrzovací
# odkazy mířily na konkrétní nasazení a po dalším deployi přestaly platit.
NEXT_PUBLIC_SITE_URL=https://ucebna.weeks.cz
```

`SUPABASE_URL` a `NEXT_PUBLIC_SUPABASE_URL` musí ukazovat na **stejný** projekt.
Viz bod 0.

---

## 5. Doména

Vercel → Settings → Domains → `ucebna.weeks.cz`, CNAME na `cname.vercel-dns.com`.

---

## 6. Zkouška před spuštěním

Projdi tohle ručně, ideálně na telefonu i na počítači:

- [ ] `/` se načte a odkaz „Zkusit první lekci" vede na lekci
- [ ] lekci projdeš **bez přihlášení** a po dokončení se objeví zeď
- [ ] v DevTools → Application → Local Storage je `ucebna.anon.v1` s dokončenou lekcí
- [ ] registrace e-mailem → přijde český e-mail ve Weeks brandu
- [ ] po potvrzení adresy tě to hodí do onboardingu, ne na prázdnou stránku
- [ ] onboarding neprojde bez souhlasu zákonného zástupce
- [ ] po dokončení je v `/ucet` profil dítěte a **dokončená lekce z anonymní relace**
- [ ] přihlášení Googlem u nového účtu skončí taky v onboardingu
- [ ] nastavíš dítěti PIN, odhlásíš se, přihlásíš, PIN se zeptá
- [ ] pětkrát špatný PIN profil zamkne, rodič ho odemkne v `/ucet/deti`
- [ ] `/ucet/souhlasy` odvolá obchodní sdělení jedním tlačítkem
- [ ] `/tabor` pořád funguje jako dřív
- [ ] `/ucet` bez přihlášení přesměruje na `/prihlaseni`

Rychlá kontrola bezpečnosti v SQL Editoru:

```sql
-- Nesmí vrátit nic: klient nemá mít přístup k PIN sloupcům.
select grantee, column_name
  from information_schema.column_privileges
 where table_name = 'children'
   and grantee = 'authenticated'
   and column_name in ('pin_hash', 'pin_failed_attempts', 'pin_locked_until');

-- Nesmí vrátit nic: o penězích rozhoduje jen servisní role.
select grantee, column_name
  from information_schema.column_privileges
 where table_name = 'parents'
   and grantee = 'authenticated'
   and column_name in ('plan', 'plan_expires_at', 'premium_activated_at');

-- Všechny tabulky musí mít rowsecurity = true.
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```

---

## 7. Co v kódu záměrně není

| Věc | Kdy |
|---|---|
| Obsah lekce 1, zadání a video z HWLabu | blok 1.3 |
| Circuit builder v lekci (+ 55 typových chyb) | blok 1.3 — 48 z nich už spravených, viz níž |
| Kontrola správnosti zapojení | až po bráně 1 |
| Platby živě, certifikát, měsíční report | fáze 2 |
| Dashboard | až po bráně 1; do ní stačí dotazy z `docs/metriky-brana-1.sql` |
| GA4 a Meta Pixel podmíněné souhlasem | blok 1.2 |

---

## 8. Mimochodem

Auditní nález N11 mluví o 58 typových chybách skrytých před buildem. Měly jeden
společný kořen: React 19 přesunul `JSX` namespace do modulu `react`, takže
globální augmentace z `@wokwi/elements` i z našeho `.d.ts` se přestala uplatňovat.
Po opravě zbyly 3 drobnosti v testech, i ty jsou hotové. **`npx tsc --noEmit`
je teď čistý** a dá se na něj spolehnout.

Tvoje rozpracovaná CAD práce je v bezpečí jako commit `4630900` na `dev`.
`main` jsem se nedotkl.
