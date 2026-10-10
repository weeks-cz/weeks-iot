-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — souhlas zákonného zástupce se váže na dítě
--
-- ── Proč ───────────────────────────────────────────────────────────────────
-- Souhlas `parental` se dával jednou za účet, při registraci prvního dítěte.
-- Rodič, který později přidá další dítě mladší 15 let, žádný souhlas k jeho
-- údajům nedal — a ledger přitom měl vypadat, že ano. Každé dítě do 15 let
-- proto dostane vlastní řádek `parental` navázaný na `child_id`.
--
-- ── Co se mění ─────────────────────────────────────────────────────────────
-- 1. consents.child_id — NULL u souhlasů za účet (terms, self, marketing
--    a parental z registrace), vyplněno u souhlasu za konkrétní dítě.
--    `on delete set null`: smazání profilu ledger nestrhne (stejná logika
--    jako u účtu, migrace 013).
-- 2. record_child_consent() — jediná cesta, jak zapsat souhlas za dítě.
--    Ověří, že dítě patří přihlášenému účtu, a přijme jen druh `parental`.
--    Stejně jako record_consent snapshot znění i IP dodává server.
--
-- ── Nasazení ───────────────────────────────────────────────────────────────
-- Spustit PŘED nasazením kódu. Bez této migrace selže přidání dítěte mladšího
-- 15 let s chybou „Souhlas se nepodařilo uložit" — nic se tiše nerozbije.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.consents
  add column child_id uuid references public.children(id) on delete set null;

create index consents_child_idx
  on public.consents (child_id, kind, created_at desc)
  where child_id is not null;

create or replace function public.record_child_consent(
  p_child_id      uuid,
  p_kind          public.consent_kind,
  p_version       text,
  p_text_snapshot text,
  p_granted       boolean,
  p_ip            inet default null,
  p_user_agent    text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
begin
  if auth.uid() is null then
    raise exception 'record_child_consent: bez přihlášeného uživatele';
  end if;

  if p_kind <> 'parental' then
    raise exception 'record_child_consent: za dítě se zapisuje jen souhlas zákonného zástupce';
  end if;

  if not exists (
    select 1 from public.children
     where id = p_child_id and parent_id = auth.uid()
  ) then
    raise exception 'record_child_consent: profil nepatří přihlášenému účtu';
  end if;

  insert into public.consents
    (parent_id, child_id, kind, version, text_snapshot, granted, ip, user_agent)
  values
    (auth.uid(), p_child_id, p_kind, p_version, p_text_snapshot, p_granted, p_ip, p_user_agent)
  returning id into new_id;

  return new_id;
end $$;

revoke all on function public.record_child_consent from public, anon;
grant execute on function public.record_child_consent to authenticated;
