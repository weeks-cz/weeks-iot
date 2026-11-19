-- ═══════════════════════════════════════════════════════════════════════════
-- Brána 1 — vyhodnocení 15. 12. 2026 (posunuto z 19. 10.: měří se od prvního
-- IG postu; brána pouští placenou reklamu, ne první marketing)
--
-- Podmínka: 40 registrovaných zvenčí a ≥ 40 % z těch, kdo začali, dokončí
-- první lekci.
--
-- Dashboard se staví až PO bráně (audit 5.4). Brána potřebuje čísla, ne
-- obrazovku — a šest ušetřených hodin v nejtěsnějším období stojí za to.
-- Pusť tohle jednou měsíčně v SQL Editoru.
--
-- Definice, které musí platit napříč vším:
--   registrovaný      = dokončený onboarding rodiče, ne otevřená stránka
--   dokončení kurzu   = dokončená poslední lekce, z těch kdo začali lekci 1
--   návrat v N+1      = dítě s alespoň jedním lesson_start v kalendářním
--                       týdnu následujícím po týdnu registrace
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Registrovaní zvenčí ────────────────────────────────────────────────
-- Cíl brány: 40. Neúspěch plánu pod 100 za celou sezónu, plán 180–250.
--
-- „Zvenčí" znamená bez lektora. Účty z tábora sem nepatří — táborový režim
-- žádné rodiče nezakládá, takže je stačí odlišit podle zdroje.
--
-- Registrace není věkově omezená (strop by jen odmítal staršího sourozence
-- nebo učitele), takže se cílová skupina 9–15 let (stejně jako tábor) počítá až tady. Jde to
-- přesně, protože se od migrace 006 ukládá celé datum narození.

select
  count(*) filter (where p.onboarding_completed_at is not null) as registrovani,
  count(*) filter (where p.onboarding_completed_at is null)     as nedokoncene,
  count(*) filter (where p.utm_source is not null)              as z_kampane,
  count(*) filter (where p.utm_source is null)                  as prima_navsteva
from public.parents p;


-- ── 1b. Registrovaní v cílové skupině ─────────────────────────────────────
-- Tohle je číslo pro bránu. Účet se počítá tehdy, když má aspoň jeden
-- profil ve věku 9–15 let. Tým a testovací účty se nepočítají.

with vek as (
  select
    c.parent_id,
    extract(year from age(current_date, c.birth_date))::int as let
  from public.children c
  where c.archived_at is null
)
select
  count(distinct p.id)                                          as vsech_uctu,
  count(distinct p.id) filter (where v.let between 9 and 15)    as v_cilove_skupine,
  count(distinct p.id) filter (where v.let < 9)                 as mladsi,
  count(distinct p.id) filter (where v.let > 15)                as starsi
from public.parents p
join vek v on v.parent_id = p.id
where p.onboarding_completed_at is not null
  -- Zvenčí = bez týmu a testů (rozhodnutí 19. 10.).
  and p.email not ilike '%@weeks.cz'
  and p.email not ilike '%@resend.dev'
  and p.email not ilike 'test+%';


-- ── 2. Hlavní metrika brány: dokončení první lekce ────────────────────────
-- Čitatel i jmenovatel z learning_events, ne z tabulky progress — jmenovatel
-- musí zahrnout i anonymní návštěvníky, kteří účet nikdy nezaložili.
-- To je celý nález N4: bez toho se metrika nedá spočítat vůbec.

with zacali as (
  select distinct coalesce(anon_id, parent_id::text) as kdo
    from public.learning_events
   where type = 'lesson_start'
     and props->>'order' = '1'
),
dokoncili as (
  select distinct coalesce(anon_id, parent_id::text) as kdo
    from public.learning_events
   where type = 'lesson_complete'
     and props->>'order' = '1'
)
select
  (select count(*) from zacali)                                  as zacalo,
  (select count(*) from dokoncili)                               as dokoncilo,
  round(
    100.0 * (select count(*) from dokoncili)
          / nullif((select count(*) from zacali), 0),
    1
  )                                                              as procento,
  case
    when (select count(*) from zacali) = 0 then 'zatím žádná data'
    when 100.0 * (select count(*) from dokoncili)
              / (select count(*) from zacali) >= 40 then 'BRÁNA SPLNĚNA'
    else 'pod hranicí 40 %'
  end                                                            as verdikt;


-- ── 3. Trychtýř registrace ────────────────────────────────────────────────
-- Kde se lidé ztrácejí. Největší propad ukazuje, co opravit jako první.

select
  count(*) filter (where type = 'visit_first')        as navstevy,
  count(*) filter (where type = 'lesson_start')       as zacali_lekci,
  count(*) filter (where type = 'lesson_complete')    as dokoncili_lekci,
  count(*) filter (where type = 'signup_prompt_view') as videli_zed,
  count(*) filter (where type = 'signup_parent')      as zaregistrovali_se
from public.learning_events;


-- ── 3b. Registrace krok po kroku (od nasazení měření, listopad 2026) ──────
-- Mezi signup_start a signup_parent dřív nebylo nic. Teď:
--   signup_view → signup_email_submit / auth_google_* → email_confirmed
--   → onboarding_step_view 1–3 → signup_parent
--
-- IDENTITA — proč se tu nepoužívá coalesce(anon_id, parent_id) jako v části 2:
--   * před přihlášením nese řádek jen anon_id (zobrazení, formulář, klik
--     na Google),
--   * email_confirmed jen parent_id — zapisuje ho server a odkaz se často
--     otevře v jiném prohlížeči, než kde rodič začal,
--   * po přihlášení oboje (auth_google_success, onboarding, signup_parent).
-- coalesce by jednoho člověka rozdělil na dva. Každý krok se proto počítá
-- svým klíčem: anonymní kroky přes anon_id, ostatní přes parent_id. Čísla
-- jsou počty lidí, ale napříč klíči jen přibližně srovnatelná.
--
-- TESTY: účty test+…, @weeks.cz a @resend.dev se vyřazují přes parent_id
-- a přes každé anon_id, které se s takovým účtem někdy objevilo. Anonymní
-- zkoušku bez registrace odlišit nejde — ta v číslech zůstane.
--
-- E-MAILOVÍ ROBOTI: některé schránky (hlavně firemní) odkaz otevřou samy,
-- dřív než člověk. Pak je email_confirmed ok=true z robota a skutečný klik
-- rodiče skončí jako ok=false („odkaz už byl použit“). Řádky ok=false proto
-- nečti jako „rozbitý odkaz“.
--
-- Od nasazení měření (push 13. 11. 2026 13:35, na produkci ověřeno 13:50).
-- Dřív nové události neexistují a trychtýř by ukazoval falešný propad:
-- registrace bez změřených kroků mezi nimi.

with param as (
  select timestamptz '2026-11-13 13:50 Europe/Prague' as od   -- ověřeno živé na produkci
),
testovaci as (
  select id from public.parents
   where email ilike '%@weeks.cz' or email ilike '%@resend.dev' or email ilike 'test+%'
),
testovaci_anon as (
  select distinct e.anon_id
    from public.learning_events e
    join testovaci t on t.id = e.parent_id
   where e.anon_id is not null
),
ev as (
  select e.*
    from public.learning_events e, param
   where e.created_at >= param.od
     and (e.parent_id is null or e.parent_id not in (select id from testovaci))
     and (e.anon_id   is null or e.anon_id   not in (select anon_id from testovaci_anon))
)
select
  -- Anonymní kroky (anon_id)
  count(distinct anon_id)   filter (where type = 'signup_view')                                   as "1 videli registraci",
  count(distinct anon_id)   filter (where type = 'signup_view' and props->>'had_lesson' = 'true') as "1a z toho po lekci",
  count(distinct anon_id)   filter (where type = 'signup_email_submit')                           as "2 odeslali formular",
  count(distinct anon_id)   filter (where type = 'signup_email_submit' and props->>'result' = 'sent') as "2a e-mail odeslan",
  count(distinct anon_id)   filter (where type = 'signup_email_submit' and props->>'result' = 'invalid') as "2b chyba ve formulari",
  -- Google stojí na /registrace i na /prihlaseni. Na přihlášení klikají
  -- i vracející se rodiče, ale účet jde založit i odtamtud — proto dva
  -- sloupce, ne filtr.
  count(distinct anon_id)   filter (where type = 'auth_google_click'   and props->>'page' = 'registrace') as "3 Google klik (registrace)",
  count(distinct anon_id)   filter (where type = 'auth_google_click'   and props->>'page' = 'prihlaseni') as "3 Google klik (prihlaseni)",
  count(distinct anon_id)   filter (where type = 'auth_google_success' and props->>'page' = 'registrace') as "3a Google prosel (registrace)",
  count(distinct anon_id)   filter (where type = 'auth_google_success' and props->>'page' = 'prihlaseni') as "3a Google prosel (prihlaseni)",
  -- Chyby podle místa. `script` NENÍ selhání registrace: skript Googlu se
  -- nestáhl při načtení stránky (blokátor, vestavěný prohlížeč), bez kliku,
  -- a rodič dostal záložní tlačítko. `redirect` se vždy ukazuje na
  -- /prihlaseni, i když tok začal na registraci.
  count(distinct anon_id)   filter (where type = 'auth_google_error' and props->>'stage' = 'token')    as "3b Google odmitl token",
  count(distinct anon_id)   filter (where type = 'auth_google_error' and props->>'stage' = 'redirect') as "3c Google chyba po presmerovani",
  count(distinct anon_id)   filter (where type = 'auth_google_error' and props->>'stage' = 'script')   as "3d skript Googlu se nenacetl",
  -- Kroky s účtem (parent_id)
  count(distinct parent_id) filter (where type = 'email_confirmed' and props->>'ok' = 'true')     as "4 potvrdili e-mail",
  count(*)                  filter (where type = 'email_confirmed' and props->>'ok' = 'false')    as "4x odkaz neprosel",
  count(distinct parent_id) filter (where type = 'onboarding_step_view' and props->>'step' = '1') as "5 onboarding krok 1",
  count(distinct parent_id) filter (where type = 'onboarding_step_view' and props->>'step' = '2') as "6 onboarding krok 2",
  count(distinct parent_id) filter (where type = 'onboarding_step_view' and props->>'step' = '3') as "7 onboarding krok 3",
  count(distinct parent_id) filter (where type = 'signup_parent')                                 as "8 zaregistrovani",
  count(distinct parent_id) filter (where type = 'signup_parent' and props->>'method' = 'google') as "8a z toho Googlem"
from ev;


-- ── 3c. Podle prostředí (běžný prohlížeč / Facebook / Instagram) ──────────
-- Hypotéza 1: ve vestavěném prohlížeči Facebooku a Instagramu Google
-- nefunguje. Čti klik → prošel → odmítl token v řádku daného prostředí.
-- Hypotéza 2: kdo se registruje ve Facebooku, otevře potvrzovací odkaz
-- jinde (a ztratí postup z lekce). U email_confirmed je `env` prostředí,
-- kde se odkaz OTEVŘEL. Konkrétního člověka spárovat nejde (jiný prohlížeč
-- = jiné anon_id), jen podíly: e-mail_odeslan vs. otevreli_odkaz v řádku
-- facebook / instagram.
-- `env` nese jen jednu ze tří hodnot, nikdy user agent.
-- (Stejné CTE jako v 3b — SQL Editor pouští dotazy zvlášť.)

with param as (
  select timestamptz '2026-11-13 13:50 Europe/Prague' as od   -- ověřeno živé na produkci
),
testovaci as (
  select id from public.parents
   where email ilike '%@weeks.cz' or email ilike '%@resend.dev' or email ilike 'test+%'
),
testovaci_anon as (
  select distinct e.anon_id
    from public.learning_events e
    join testovaci t on t.id = e.parent_id
   where e.anon_id is not null
),
ev as (
  select e.*
    from public.learning_events e, param
   where e.created_at >= param.od
     and (e.parent_id is null or e.parent_id not in (select id from testovaci))
     and (e.anon_id   is null or e.anon_id   not in (select anon_id from testovaci_anon))
)
select
  props->>'env'                                                              as prostredi,
  count(distinct anon_id)   filter (where type = 'visit_first')              as navstevy,
  count(distinct anon_id)   filter (where type = 'signup_view')              as videli_registraci,
  count(distinct anon_id)   filter (where type = 'auth_google_click')        as google_klik,
  count(distinct anon_id)   filter (where type = 'auth_google_success')      as google_prosel,
  count(distinct anon_id)   filter (where type = 'auth_google_error' and props->>'stage' = 'token')  as google_odmitl_token,
  count(distinct anon_id)   filter (where type = 'auth_google_error' and props->>'stage' = 'script') as google_skript_nenacten,
  count(distinct anon_id)   filter (where type = 'signup_email_submit' and props->>'result' = 'sent') as email_odeslan,
  count(distinct parent_id) filter (where type = 'email_confirmed' and props->>'ok' = 'true') as otevreli_odkaz
from ev
where props ? 'env'
group by 1
order by navstevy desc;


-- ── 4. Cena za registraci podle zdroje ────────────────────────────────────
-- Útratu doplň ručně z Google Ads a Meta. Reálné pásmo je podle kap. 3.6
-- 60–80 Kč, ne 20–40, jak tvrdil plán — stupnice byla špatně nastavená.

select
  coalesce(utm_source, '(přímá návštěva)') as zdroj,
  coalesce(utm_campaign, '—')              as kampan,
  count(*)                                 as registraci,
  count(*) filter (where r.is_camp_catchment) as ve_spadu
from public.parents p
left join public.regions r on r.code = p.region_code
where p.onboarding_completed_at is not null
group by 1, 2
order by registraci desc;


-- ── 5. Rozdělení publika ──────────────────────────────────────────────────
-- Kolik lidí uvidí kartu termínu a kolik čekačku. Rozhoduje o tom, jestli
-- má smysl utrácet za reklamu mimo spád.

select
  r.name                                        as kraj,
  r.is_camp_catchment                           as ve_spadu,
  count(p.id)                                   as rodicu
from public.regions r
left join public.parents p
       on p.region_code = r.code
      and p.onboarding_completed_at is not null
group by r.name, r.is_camp_catchment, r.sort_order
order by r.is_camp_catchment desc, count(p.id) desc;


-- ── 6. Čekačka měst ───────────────────────────────────────────────────────
-- Cíl plánu: 2 města s ≥ 10 zájemci. Tohle je podklad pro expanzi 2028
-- a druhý výstup celého projektu.

select
  initcap(lower(btrim(city))) as mesto,
  count(*)                    as zajemcu,
  min(created_at)::date       as prvni_zajem
from public.city_waitlist
group by 1
having count(*) >= 3
order by zajemcu desc;


-- ── 7. Návrat v dalším týdnu ──────────────────────────────────────────────
-- Cíl plánu: 30 %. Podle Duolinga předpovídá zavedení sedmidenní série
-- dlouhodobou retenci líp než třicetidenní.

with registrace as (
  select id, date_trunc('week', created_at) as tyden_registrace
    from public.parents
   where onboarding_completed_at is not null
),
aktivita as (
  select distinct
         e.parent_id,
         date_trunc('week', e.created_at) as tyden
    from public.learning_events e
   where e.type = 'lesson_start'
     and e.parent_id is not null
)
select
  count(*)                                                as registrovanych,
  count(*) filter (where a.parent_id is not null)         as vratilo_se,
  round(
    100.0 * count(*) filter (where a.parent_id is not null)
          / nullif(count(*), 0),
    1
  )                                                       as procento
from registrace r
left join aktivita a
       on a.parent_id = r.id
      and a.tyden = r.tyden_registrace + interval '1 week';


-- ── 8. Trychtýř na tábor ──────────────────────────────────────────────────
-- Které místo v aplikaci prodává. Je to jediná věc, kterou se dá v sezóně
-- reálně ladit — proto každý odkaz nese utm_content s umístěním.

select
  props->>'placement' as umisteni,
  count(*)            as kliku,
  count(distinct coalesce(anon_id, parent_id::text)) as lidi
from public.learning_events
where type = 'camp_cta_click'
group by 1
order by kliku desc;


-- ── 9. Souhlasy ───────────────────────────────────────────────────────────
-- Kontrola zdraví ledgeru. Rodič bez platného souhlasu zákonného zástupce
-- by neměl existovat — kdyby se tu objevil, je chyba v onboardingu.

select
  count(*)                                                     as rodicu,
  count(*) filter (where public.has_consent(id, 'parental'))   as se_souhlasem,
  count(*) filter (where public.has_consent(id, 'marketing'))  as chce_novinky,
  count(*) filter (where not public.has_consent(id, 'parental')) as BEZ_SOUHLASU_POZOR
from public.parents
where onboarding_completed_at is not null;


-- ── 10. Odkaz na počítač (/pro-rodice) ────────────────────────────────────
-- Počty se berou ze sloupců device_link_requests, ne z událostí
-- device_link_open (ta se zapisuje při každém otevření, sloupec jen při
-- prvním). opened_at = první otevření na počítači, verified_at = na
-- jakémkoli zařízení. Registrace = dokončený onboarding s utm_term
-- z odkazu nebo z připomínky.
-- Pozor: dashboard (queries.ts) filtruje podle zvoleného období, tenhle SQL počítá za celou dobu.

select
  (select count(*) from public.device_link_requests)                      as vyzadano,
  (select count(*) from public.device_link_requests
    where opened_at is not null)                                          as otevreno_na_pc,
  (select count(*) from public.device_link_requests
    where verified_at is not null)                                        as overeno,
  (select count(*) from public.parents
    where onboarding_completed_at is not null
      and utm_term in ('odkaz-na-pc', 'pripominka-na-pc'))                as registrace;
