-- 003_payments.sql
-- Přidání plan/plan_expires_at do learning_accounts + payments tabulka
alter table public.learning_accounts
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'student')),
  add column if not exists plan_expires_at timestamptz;
-- Zápis planu jen service rolí — blanket write vzala migrace 002,
-- grant update (state) plan záměrně nezahrnuje.

create table if not exists public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  period                text not null check (period in ('monthly', 'yearly')),
  amount_kc             integer not null,
  billing_name          text,
  billing_email         text,
  comgate_payment_id    text,
  status                text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  fakturoid_invoice_id  text,
  confirmation_sent_at  timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists idx_payments_comgate_id
  on public.payments (comgate_payment_id) where comgate_payment_id is not null;
create index if not exists idx_payments_user on public.payments (user_id);

alter table public.payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'payments' and policyname = 'own_payments_select'
  ) then
    create policy "own_payments_select" on public.payments
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- Žádná insert/update politika pro authenticated → zápis jen service role.
revoke insert, update, delete on public.payments from anon, authenticated;

create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.touch_updated_at();
