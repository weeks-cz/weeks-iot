-- ===== learning_accounts =====
create table if not exists public.learning_accounts (
  id          uuid primary key references auth.users(id) on delete cascade,
  state       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'learning_accounts_touch'
  ) then
    create trigger learning_accounts_touch
      before update on public.learning_accounts
      for each row execute function public.touch_updated_at();
  end if;
end $$;

create index if not exists learning_accounts_updated_at_idx
  on public.learning_accounts(updated_at desc);

alter table public.learning_accounts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'learning_accounts' and policyname = 'own_account_select'
  ) then
    create policy "own_account_select" on public.learning_accounts
      for select using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'learning_accounts' and policyname = 'own_account_insert'
  ) then
    create policy "own_account_insert" on public.learning_accounts
      for insert with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'learning_accounts' and policyname = 'own_account_update'
  ) then
    create policy "own_account_update" on public.learning_accounts
      for update using (auth.uid() = id);
  end if;
end $$;

-- ===== learning_events =====
create table if not exists public.learning_events (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  event_type  text not null,
  task_id     text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists learning_events_user_idx
  on public.learning_events(user_id);
create index if not exists learning_events_type_created_idx
  on public.learning_events(event_type, created_at desc);
create index if not exists learning_events_created_idx
  on public.learning_events(created_at desc);

-- Note: No SELECT policy. Users insert events fire-and-forget; analytics read via service role.
alter table public.learning_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'learning_events' and policyname = 'own_events_insert'
  ) then
    create policy "own_events_insert" on public.learning_events
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

-- ===== grants =====
grant select, insert, update on public.learning_accounts to authenticated;
grant select, insert          on public.learning_events  to authenticated;
grant select                  on public.learning_accounts to service_role;
grant select                  on public.learning_events  to service_role;
