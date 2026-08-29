-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — RLS, granty a politiky
--
-- Pravidlo, které audit chválí u táborové migrace 002 a které se sem
-- rozšiřuje beze změny: klient nesmí zapsat nic, co rozhoduje o penězích
-- nebo o přístupu. Vynucuje se to sloupcovými granty, ne důvěrou v UI.
--
-- Výchozí odpověď je zákaz. Postgres bez `grant` nic nepustí a RLS bez
-- politiky taky ne — obojí je tu schválně a doplňuje se.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Odebrat všechno, co Supabase rozdává plošně ────────────────────────────
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter table public.regions         enable row level security;
alter table public.parents         enable row level security;
alter table public.consents        enable row level security;
alter table public.children        enable row level security;
alter table public.courses         enable row level security;
alter table public.lessons         enable row level security;
alter table public.progress        enable row level security;
alter table public.projects        enable row level security;
alter table public.learning_events enable row level security;
alter table public.city_waitlist   enable row level security;
alter table public.rate_limits     enable row level security;

-- ═══ Veřejný číselník a obsah ══════════════════════════════════════════════
-- Kraje a publikované kurzy musí vidět i nepřihlášený návštěvník — celý
-- vstup bez registrace na tom stojí.

grant select on public.regions to anon, authenticated;
create policy regions_read on public.regions
  for select to anon, authenticated using (true);

grant select on public.courses to anon, authenticated;
create policy courses_read on public.courses
  for select to anon, authenticated using (is_published);

grant select on public.lessons to anon, authenticated;
create policy lessons_read on public.lessons
  for select to anon, authenticated using (is_published);

-- ═══ parents ═══════════════════════════════════════════════════════════════
-- Čtení vlastního řádku celé. Zápis JEN u sloupců, které nerozhodují
-- o penězích: plan, plan_expires_at a premium_activated_at chybí ve výčtu
-- schválně a píše je výhradně servisní role přes callback platební brány.

grant select on public.parents to authenticated;
grant update (region_code, onboarding_completed_at, deletion_requested_at,
              utm_source, utm_medium, utm_campaign, utm_content, utm_term,
              referrer, landing_path)
  on public.parents to authenticated;

create policy parents_read_own on public.parents
  for select to authenticated using (id = auth.uid());

create policy parents_update_own on public.parents
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Insert nikdo nedostane: řádek zakládá trigger handle_new_user().

-- ═══ consents ══════════════════════════════════════════════════════════════
-- Append-only. Update ani delete se nedávají NIKOMU, ani vlastníkovi —
-- ledger, který jde přepsat, není důkaz. Odvolání je nový řádek.
--
-- Insert taky ne: souhlas se zapisuje výhradně přes record_consent(), aby
-- se text_snapshot a IP nedaly podvrhnout z prohlížeče.

grant select on public.consents to authenticated;

create policy consents_read_own on public.consents
  for select to authenticated using (parent_id = auth.uid());

/**
 * Zápis souhlasu. security definer, protože klient nemá insert grant.
 *
 * Snapshot znění i IP dodává server — kdyby je posílal prohlížeč, byl by
 * ledger falšovatelný a jako důkaz bezcenný.
 */
create or replace function public.record_consent(
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
    raise exception 'record_consent: bez přihlášeného uživatele';
  end if;

  insert into public.consents
    (parent_id, kind, version, text_snapshot, granted, ip, user_agent)
  values
    (auth.uid(), p_kind, p_version, p_text_snapshot, p_granted, p_ip, p_user_agent)
  returning id into new_id;

  return new_id;
end $$;

revoke all on function public.record_consent from public, anon;
grant execute on function public.record_consent to authenticated;

/** Platí souhlas daného druhu? Poslední řádek vyhrává. */
create or replace function public.has_consent(p_parent uuid, p_kind public.consent_kind)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select granted
       from public.consents
      where parent_id = p_parent and kind = p_kind
      order by created_at desc, id desc
      limit 1),
    false
  );
$$;

grant execute on function public.has_consent to authenticated;

-- ═══ children ══════════════════════════════════════════════════════════════
-- pin_hash, pin_failed_attempts a pin_locked_until chybí v grantech
-- schválně: ověření PINu tak nemůže proběhnout v prohlížeči ani omylem
-- a hash se nedá přečíst z bundlu. Píše je jen servisní role.

grant select (id, parent_id, nick, birth_year, avatar, archived_at, created_at, updated_at)
  on public.children to authenticated;
grant insert (parent_id, nick, birth_year, avatar)
  on public.children to authenticated;
grant update (nick, birth_year, avatar, archived_at)
  on public.children to authenticated;
grant delete on public.children to authenticated;

create policy children_read_own on public.children
  for select to authenticated using (parent_id = auth.uid());

create policy children_insert_own on public.children
  for insert to authenticated with check (parent_id = auth.uid());

create policy children_update_own on public.children
  for update to authenticated using (parent_id = auth.uid()) with check (parent_id = auth.uid());

create policy children_delete_own on public.children
  for delete to authenticated using (parent_id = auth.uid());

/** Má dítě nastavený PIN? Odpovídá ano/ne, nikdy hash. */
create or replace function public.child_has_pin(p_child uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.children c
    where c.id = p_child and c.parent_id = auth.uid() and c.pin_hash is not null
  );
$$;

grant execute on function public.child_has_pin to authenticated;

-- ═══ progress ══════════════════════════════════════════════════════════════

grant select, insert, update on public.progress to authenticated;
grant usage, select on sequence public.progress_id_seq to authenticated;

create policy progress_read_own on public.progress
  for select to authenticated using (public.owns_child(child_id));

create policy progress_insert_own on public.progress
  for insert to authenticated with check (public.owns_child(child_id));

create policy progress_update_own on public.progress
  for update to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));

-- ═══ projects ══════════════════════════════════════════════════════════════

grant select, insert, update, delete on public.projects to authenticated;

create policy projects_read_own on public.projects
  for select to authenticated using (public.owns_child(child_id));

create policy projects_insert_own on public.projects
  for insert to authenticated with check (public.owns_child(child_id));

create policy projects_update_own on public.projects
  for update to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));

create policy projects_delete_own on public.projects
  for delete to authenticated using (public.owns_child(child_id));

-- ═══ learning_events ═══════════════════════════════════════════════════════
-- Jen pro zápis, bez čtení, úprav a mazání — převzato z dneška, kde je to
-- správně. Anonymní návštěvník zapisovat MUSÍ: bez jeho lesson_start
-- neexistuje jmenovatel metriky brány 1.
--
-- parent_id si klient nesmí vymyslet; politika ho přibíjí na auth.uid()
-- a u anonyma vynucuje null.

grant insert on public.learning_events to anon, authenticated;
grant usage, select on sequence public.learning_events_id_seq to anon, authenticated;

create policy events_insert_anon on public.learning_events
  for insert to anon with check (parent_id is null and child_id is null);

create policy events_insert_auth on public.learning_events
  for insert to authenticated
  with check (
    (parent_id is null or parent_id = auth.uid())
    and (child_id is null or public.owns_child(child_id))
  );

-- ═══ city_waitlist ═════════════════════════════════════════════════════════

grant insert on public.city_waitlist to anon, authenticated;
grant select on public.city_waitlist to authenticated;
grant usage, select on sequence public.city_waitlist_id_seq to anon, authenticated;

create policy waitlist_insert_anon on public.city_waitlist
  for insert to anon with check (parent_id is null);

create policy waitlist_insert_auth on public.city_waitlist
  for insert to authenticated
  with check (parent_id is null or parent_id = auth.uid());

create policy waitlist_read_own on public.city_waitlist
  for select to authenticated using (parent_id = auth.uid());

-- ═══ rate_limits ═══════════════════════════════════════════════════════════
-- Čistě serverová tabulka. Klient sem nesmí ani nahlédnout — kdyby viděl
-- stav počítadla, věděl by přesně, kdy má přestat a kdy může začít znovu.
-- Žádný grant, žádná politika. RLS je zapnuté jako pojistka.

-- ═══ Servisní role ═════════════════════════════════════════════════════════
-- Servisní role obchází RLS z principu. Granty jsou tu explicitně, aby bylo
-- v jednom souboru vidět, co všechno server smí.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
