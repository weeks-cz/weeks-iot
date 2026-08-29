-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — typ účtu
--
-- Od migrace 005 může účet patřit dvěma různým lidem:
--   • rodiči, který spravuje profil dítěte mladšího 15 let
--   • uživateli od 15 let, který se učí sám
--
-- Datově je to totéž — `parents` je ve skutečnosti „držitel účtu"
-- a `children` „učící se profil"; ta jména jsou historická z doby, kdy
-- účet zakládal vždycky rodič. Jenže aplikace o tom rozdílu neví, a tak
-- mluví na všechny jako na rodiče: patnáctiletý, který se učí sám, vidí
-- „Profily dětí" a „Kdo se dneska učí?".
--
-- Odvozovat to pokaždé z ledgeru souhlasů by šlo, ale je to dotaz navíc
-- na každé vykreslení a snadno se rozejde s tím, co uživatel skutečně
-- podepsal. Uložíme to jednou, při onboardingu.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.account_type as enum ('guardian', 'self');

alter table public.parents
  add column account_type public.account_type not null default 'guardian';

comment on column public.parents.account_type is
  'guardian = účet spravuje zákonný zástupce za dítě do 15 let; '
  'self = držitel účtu se učí sám. Musí odpovídat druhu souhlasu v ledgeru.';

-- Dopočet u účtů, které vznikly před touto migrací: rozhoduje poslední
-- platný souhlas druhu 'self'.
update public.parents p
   set account_type = 'self'
 where public.has_consent(p.id, 'self');

-- Klient smí sloupec číst, ale ne měnit — typ účtu určuje, který souhlas
-- byl podepsán, a to není nic, co by šlo přepnout z prohlížeče.
grant select (id, email, region_code, onboarding_completed_at, account_type,
              plan, plan_expires_at, premium_activated_at,
              utm_source, utm_medium, utm_campaign, utm_content, utm_term,
              referrer, landing_path, deletion_requested_at,
              created_at, updated_at)
  on public.parents to authenticated;
