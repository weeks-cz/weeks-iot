### Task C1: Migrace 003 — plan + payments

**Files:**
- Create: `supabase/migrations/003_payments.sql`

- [ ] **Step 1: Napiš migraci** (ověř v `001_initial_schema.sql` název trigger funkce pro `updated_at` na `learning_accounts` — použij stejnou; níže předpokládám `public.set_updated_at()`):

```sql
-- 003_payments.sql
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
create policy own_payments_select on public.payments
  for select using (auth.uid() = user_id);
-- Žádná insert/update politika pro authenticated → zápis jen service role.
revoke insert, update, delete on public.payments from anon, authenticated;

create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Zkontroluj proti 001** — jméno trigger funkce, konvence názvů politik. Uprav dle skutečnosti.
- [ ] **Step 3: Commit** `feat(payments): migration — learning_accounts.plan + payments table (RLS select-only)`

