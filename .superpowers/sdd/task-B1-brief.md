### Task B1: Column-level write protection (migrace 002)

Dnes RLS `own_account_update` dovoluje UPDATE celého řádku. Po přidání `plan` (Task C1) by se uživatel mohl sám upgradovat. Blanket grant nahradíme column-level grantem.

**Files:**
- Create: `supabase/migrations/002_security_hardening.sql`

- [ ] **Step 1: Napiš migraci**

```sql
-- 002_security_hardening.sql
-- Klient (anon/authenticated) smí v learning_accounts zapisovat JEN state.
-- Připravuje půdu pro learning_accounts.plan (migrace 003) — ten bude
-- zapisovatelný výhradně service rolí.

revoke insert, update, delete on public.learning_accounts from anon, authenticated;
grant insert (id, state) on public.learning_accounts to authenticated;
grant update (state) on public.learning_accounts to authenticated;

-- learning_events: insert-only pro klienta (žádné update/delete/select).
revoke update, delete, select on public.learning_events from anon, authenticated;
```

- [ ] **Step 2: Ověř lokálně proti vzdálené DB nanečisto** — NEAPLIKOVAT bez Lukáše. Migrace se aplikují ručně v launch checklistu (Supabase SQL editor / `supabase db push`). Zkontroluj jen, že SQL parsuje: `psql` není potřeba — code review stačí (žádný lokální supabase stack v repu).
- [ ] **Step 3: Ověř kompatibilitu klienta:** grep, že klient nikde nedělá `.delete()` ani `.update()` s jinými sloupci než `state` na `learning_accounts` (`grep -rn "learning_accounts" src/`) a že z `learning_events` nikde nečte anon klientem. Očekávání: jen insert eventů + select/upsert/update `state` — vše kompatibilní.
- [ ] **Step 4: Commit** `feat(security): column-level grants — client writes only learning_accounts.state`

