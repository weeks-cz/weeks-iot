-- ═══════════════════════════════════════════════════════════════════════════
-- Brána 1 — 19. 10. 2026
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

select
  count(*) filter (where onboarding_completed_at is not null) as registrovani,
  count(*) filter (where onboarding_completed_at is null)     as nedokoncene,
  count(*) filter (where utm_source is not null)              as z_kampane,
  count(*) filter (where utm_source is null)                  as prima_navsteva
from public.parents;


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
