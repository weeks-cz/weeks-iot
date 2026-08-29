-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — přesné datum narození
--
-- Audit původně zvolil jen rok narození: „na věkové pásmo to stačí a je to
-- méně údajů". To platilo, dokud se od věku neodvíjelo nic než obtížnost
-- obsahu. Jakmile na věku začalo záviset, KDO smí podepsat souhlas
-- (§ 7 zák. 110/2019, hranice 15 let), přestal rok stačit.
--
-- Konkrétní chyba: dítě narozené 20. 12. 2011 je 29. 8. 2026 staré
-- 14 let a 8 měsíců, ale výpočet 2026 − 2011 dal 15. Aplikace by mu
-- nabídla vlastní souhlas místo rodičovského — a takový záznam
-- v ledgeru je neplatný. Týkalo se to celého ročníku na hranici, tedy
-- zrovna té skupiny, kvůli které rozvětvení vzniklo.
--
-- `birth_year` nemizí, jen se stává GENEROVANÝM sloupcem. Dotazy, které
-- pracují s ročníkem, fungují dál a nemůžou se s datem rozejít.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.children add column birth_date date;

-- Dopočet u řádků, které vznikly před touto migrací. 1. července je střed
-- roku, tedy nejmenší možná chyba při neznámém dni. Testovacích účtů jsou
-- jednotky; u ostrého provozu by se muselo doptat.
update public.children
   set birth_date = make_date(birth_year, 7, 1)
 where birth_date is null;

alter table public.children alter column birth_date set not null;

alter table public.children
  add constraint children_birth_date_sane
  check (birth_date between date '1980-01-01' and date '2100-01-01');

-- Starý sloupec nahradíme generovaným se stejným názvem, takže žádný
-- dotaz ani typ se nemusí přepisovat.
alter table public.children drop column birth_year;

alter table public.children
  add column birth_year integer
  generated always as (extract(year from birth_date)::integer) stored;

comment on column public.children.birth_date is
  'Přesné datum narození. Potřebné k určení hranice 15 let podle § 7 zák. 110/2019 — '
  'ze samotného ročníku ji spolehlivě určit nelze.';

comment on column public.children.birth_year is
  'Generováno z birth_date. Nezapisuje se, jen se čte.';

-- Granty se musí obnovit: sloupcová práva zanikla spolu se starým sloupcem.
grant select (id, parent_id, nick, birth_date, birth_year, avatar, archived_at, created_at, updated_at)
  on public.children to authenticated;
grant insert (parent_id, nick, birth_date, avatar)
  on public.children to authenticated;
grant update (nick, birth_date, avatar, archived_at)
  on public.children to authenticated;
