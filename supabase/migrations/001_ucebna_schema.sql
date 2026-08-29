-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — schéma
--
-- Zásadní změna proti táborovému kiosku: postup přestává být JSONB blob
-- a stává se řádky, na které jde položit dotaz. Nález N6 říká proč — hlavní
-- metrika brány 1 („kolik procent z těch, kdo začali, dokončí") se z blobu
-- nedá spočítat vůbec. JSONB zůstává jen u projects.data, kde je tvar
-- opravdu volný.
--
-- RLS, granty a politiky jsou v migraci 002. Tahle migrace tvoří jen tvar.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ── Sdílené ────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── regions ────────────────────────────────────────────────────────────────
-- Kraj rozhoduje, jestli rodič uvidí kartu letního termínu, nebo čekačku
-- na město. Spád je sloupec, ne konstanta v kódu — rozšíření na další kraj
-- pak nepotřebuje nasazení.

create table public.regions (
  code              text primary key,
  name              text not null,
  is_camp_catchment boolean not null default false,
  sort_order        integer not null default 0
);

comment on column public.regions.is_camp_catchment is
  'Spád letních táborů. true = karta termínu, false = čekačka na město.';

-- ── parents ────────────────────────────────────────────────────────────────
-- Účet zakládá rodič (Brána 0, bod 10). Důvody jsou tři a každý sám o sobě
-- by stačil: zákon (§ 7 zák. 110/2019, věk souhlasu 15 let), platba
-- (rodič je plátce) a měření (e-mail rodiče je klíč pro atribuci na tábor).

create table public.parents (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   citext not null,
  region_code             text references public.regions(code) on delete set null,

  -- Onboarding je hotový až po kraji, prvním dítěti a souhlasech. Google OAuth
  -- vyrobí uživatele mimo náš formulář, takže tenhle sloupec je jediné
  -- spolehlivé „už prošel wizardem".
  onboarding_completed_at timestamptz,

  -- O penězích rozhoduje výhradně servisní role. Klient sem nesmí zapsat
  -- ani omylem — vynucuje sloupcový grant v migraci 002.
  plan                    text not null default 'free' check (plan in ('free', 'premium')),
  plan_expires_at         timestamptz,
  premium_activated_at    timestamptz,

  -- Zachyceno při první návštěvě, přepsáno sem při registraci. Bez toho
  -- se všechno připíše přímé návštěvnosti a cena za registraci nejde měřit.
  utm_source              text,
  utm_medium              text,
  utm_campaign            text,
  utm_content             text,
  utm_term                text,
  referrer                text,
  landing_path            text,

  deletion_requested_at   timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index parents_email_key on public.parents (email);
create index parents_created_idx on public.parents (created_at desc);

create trigger parents_touch before update on public.parents
  for each row execute function public.touch_updated_at();

-- ── consents ───────────────────────────────────────────────────────────────
-- Append-only ledger. Souhlas jako sloupec na řádku rodiče nejde: odvolání
-- by ten záznam přepsalo a důkaz o tom, co člověk odsouhlasil, by zmizel.
-- GDPR přitom po správci chce prokázat *co přesně* a *kdy*.
--
-- Odvolání = nový řádek s granted = false. Řádky se nikdy neupravují ani
-- nemažou; vynucuje to chybějící update/delete grant v migraci 002.

create type public.consent_kind as enum ('terms', 'parental', 'marketing');

create table public.consents (
  id            bigserial primary key,
  parent_id     uuid not null references public.parents(id) on delete cascade,
  kind          public.consent_kind not null,
  version       text not null,
  -- Plné znění v okamžiku udělení. Když se text změní, staré souhlasy
  -- zůstanou navázané na znění, které lidé skutečně viděli.
  text_snapshot text not null,
  granted       boolean not null,
  -- IP a UA jako doklad o udělení (oprávněný zájem, čl. 6 odst. 1 písm. f).
  -- Ukládají se jen u souhlasu, ne u každého požadavku.
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index consents_lookup_idx on public.consents (parent_id, kind, created_at desc);

-- ── children ───────────────────────────────────────────────────────────────
-- Ukládá se rok narození, ne datum — na věkové pásmo to stačí a je to
-- méně údajů (audit 4.3).
--
-- PIN mění roli: z přístupové brány se stává přepínačem profilu pro rodinu
-- se dvěma dětmi na jednom počítači. Tři úrovně PINů se zálohami 123, 2468
-- a 321 v klientském stavu mizí úplně.

create table public.children (
  id                  uuid primary key default gen_random_uuid(),
  parent_id           uuid not null references public.parents(id) on delete cascade,
  nick                text not null check (char_length(btrim(nick)) between 1 and 24),
  -- Široký rozsah schválně: tohle je jen pojistka proti nesmyslu. Skutečné
  -- věkové pásmo (10–15 let) hlídá Zod, protože se v čase posouvá a check
  -- constraint musí být immutable.
  birth_year          integer not null check (birth_year between 1980 and 2100),
  avatar              text not null default 'robot',

  -- scrypt hash. Sloupec je mimo klientský grant, takže ověření PINu
  -- nemůže proběhnout v prohlížeči ani omylem.
  pin_hash            text,
  pin_failed_attempts integer not null default 0,
  pin_locked_until    timestamptz,

  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index children_parent_idx on public.children (parent_id) where archived_at is null;

create trigger children_touch before update on public.children
  for each row execute function public.touch_updated_at();

-- ── courses / lessons ──────────────────────────────────────────────────────
-- Kurz je 6 až 8 lekcí po 20–30 minutách a končí projektem, který jde
-- ukázat rodičovi. Slug je URL, order_index je postup.

create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  summary      text,
  order_index  integer not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger courses_touch before update on public.courses
  for each row execute function public.touch_updated_at();

create table public.lessons (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references public.courses(id) on delete cascade,
  slug              text not null,
  title             text not null,
  summary           text,
  order_index       integer not null,
  -- Vazba na existujících 31 úloh v legacy tasks.ts. Brána 0, bod 4:
  -- úlohy se použijí jako data pro nové lekce, ne jako kód.
  legacy_task_id    text,
  estimated_minutes integer,
  video_url         text,
  body              jsonb not null default '{}'::jsonb,
  is_published      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (course_id, slug),
  unique (course_id, order_index) deferrable initially deferred
);

create index lessons_course_order_idx on public.lessons (course_id, order_index);

create trigger lessons_touch before update on public.lessons
  for each row execute function public.touch_updated_at();

-- ── progress ───────────────────────────────────────────────────────────────
-- Řádky, ne blob. Unikátní dvojice (dítě, lekce) je zároveň to, co dělá
-- přenos anonymního postupu idempotentním — dvojí odeslání nezdvojí postup.

create type public.progress_status as enum ('started', 'completed');

create table public.progress (
  id           bigserial primary key,
  child_id     uuid not null references public.children(id) on delete cascade,
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  status       public.progress_status not null default 'started',
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  duration_s   integer check (duration_s is null or duration_s >= 0),
  hints_used   integer not null default 0,
  updated_at   timestamptz not null default now(),

  unique (child_id, lesson_id),
  constraint progress_completed_consistency
    check ((status = 'completed') = (completed_at is not null))
);

create index progress_child_idx on public.progress (child_id);
create index progress_lesson_idx on public.progress (lesson_id, status);

create trigger progress_touch before update on public.progress
  for each row execute function public.touch_updated_at();

-- ── projects ───────────────────────────────────────────────────────────────
-- Jediné místo, kde JSONB opravdu patří: tvar zapojení i 3D modelu je volný.

create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references public.children(id) on delete cascade,
  lesson_id  uuid references public.lessons(id) on delete set null,
  kind       text not null default 'circuit' check (kind in ('circuit', 'model', 'code')),
  title      text,
  data       jsonb not null default '{}'::jsonb,
  thumbnail  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_child_idx on public.projects (child_id, updated_at desc);

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ── learning_events ────────────────────────────────────────────────────────
-- Nález N4: dnes chybí událost „začal", takže hlavní metrika nejde spočítat
-- vůbec. A události posílá jen přihlášený uživatel — anonymní relace nic,
-- což je přesně ten jmenovatel, který brána potřebuje. Proto anon_id.

create table public.learning_events (
  id         bigserial primary key,
  parent_id  uuid references public.parents(id) on delete set null,
  child_id   uuid references public.children(id) on delete set null,
  -- Náhodný identifikátor anonymní relace z prohlížeče. Není to osobní údaj:
  -- nenese e-mail, jméno ani rok narození, slouží jen ke spárování událostí
  -- jedné návštěvy před registrací.
  anon_id    text,
  type       text not null,
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index learning_events_type_created_idx on public.learning_events (type, created_at desc);
create index learning_events_parent_idx on public.learning_events (parent_id, created_at desc);
create index learning_events_anon_idx on public.learning_events (anon_id, created_at desc);

-- ── city_waitlist ──────────────────────────────────────────────────────────
-- Druhý výstup, který dnes nikdo nemá: na jaře 2027 seznam měst seřazený
-- podle skutečné poptávky. Podklad pro expanzi 2028.

create table public.city_waitlist (
  id          bigserial primary key,
  parent_id   uuid references public.parents(id) on delete set null,
  email       citext,
  city        text not null check (char_length(btrim(city)) between 2 and 80),
  region_code text references public.regions(code) on delete set null,
  created_at  timestamptz not null default now()
);

create index city_waitlist_city_idx on public.city_waitlist (lower(city));

-- ── rate_limits ────────────────────────────────────────────────────────────
-- Omezování bez externí služby. Postgres na náš objem stačí a je to o jednu
-- závislost méně, kterou by šlo zapomenout nakonfigurovat v produkci.

create table public.rate_limits (
  bucket     text not null,
  window_start timestamptz not null,
  hits       integer not null default 0,
  primary key (bucket, window_start)
);

create index rate_limits_window_idx on public.rate_limits (window_start);

-- ── Vlastnictví ────────────────────────────────────────────────────────────
-- security definer se search_path přibitým na public — bez toho jde politika
-- obejít podvržením schématu v session.

create or replace function public.owns_child(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.children c
    where c.id = target and c.parent_id = auth.uid()
  );
$$;

-- ── Založení rodiče při vzniku uživatele ───────────────────────────────────
-- Trigger, ne insert v aplikaci: Google OAuth vyrábí uživatele mimo náš
-- formulář a bez tohohle by po přihlášení přes Google neexistoval řádek
-- rodiče. Zbytek (kraj, UTM, souhlasy) doplní onboarding.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.parents (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
