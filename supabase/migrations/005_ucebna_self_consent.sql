-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — vlastní souhlas od 15 let
--
-- Brána 0, bod 10 zněla „účet zakládá rodič, dítě má pod ním profil".
-- Platí to dál pro děti mladší 15 let, ale ne pro starší: § 7 zák. 110/2019
-- klade věk digitálního souhlasu právě na 15 let, takže od té hranice
-- souhlasí člověk sám za sebe.
--
-- Nutit patnáctiletého zaškrtnout „jsem zákonný zástupce" by znamenalo
-- vyrobit nepravdivý záznam — a ledger, který obsahuje nepravdu, přestává
-- být dokladem o čemkoli.
--
-- Datový model se nemění. Účet dál drží `parents` (držitel účtu) a učící
-- se profil `children`; u samostatné registrace je to jedna a tatáž osoba.
-- ═══════════════════════════════════════════════════════════════════════════

-- Přidání hodnoty do enumu musí být v samostatné migraci: Postgres nedovolí
-- novou hodnotu použít ve stejné transakci, ve které vznikla.
alter type public.consent_kind add value if not exists 'self';

comment on type public.consent_kind is
  'terms = podmínky užití, parental = souhlas zákonného zástupce (dítě do 15 let), '
  'self = vlastní souhlas se zpracováním (od 15 let), marketing = obchodní sdělení';
