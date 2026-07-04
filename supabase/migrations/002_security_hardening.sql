-- 002_security_hardening.sql
-- Column-level grants für client RLS. Klient (anon/authenticated) smí
-- v learning_accounts zapisovat JEN state. Připravuje půdu pro
-- learning_accounts.plan (migrace 003) — ten bude zapisovatelný
-- výhradně service rolí.

revoke insert, update, delete on public.learning_accounts from anon, authenticated;
grant insert (id, state) on public.learning_accounts to authenticated;
grant update (state) on public.learning_accounts to authenticated;

-- learning_events: insert-only pro klienta (žádné update/delete/select).
revoke update, delete, select on public.learning_events from anon, authenticated;
