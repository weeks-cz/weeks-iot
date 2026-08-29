-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — granty pro servisní roli i pro budoucí tabulky
--
-- ── Chyba, kterou to opravuje ──────────────────────────────────────────────
-- Migrace 002 končí příkazem `grant all on all tables in schema public to
-- service_role`. To zní jako pravidlo, ale je to jednorázová akce: platí
-- výhradně pro tabulky, které v tu chvíli existovaly.
--
-- `email_log` vznikl až v migraci 008 a žádný grant nedostal. Zápis do něj
-- proto tiše selhával — a protože cron návratovou hodnotu insertu
-- nekontroloval, poslal při každém běhu tytéž uvítací e-maily znovu.
-- Přesně to, čemu měla ta tabulka zabránit.
--
-- ── Systémová část opravy ──────────────────────────────────────────────────
-- `alter default privileges` je skutečné pravidlo: platí i pro tabulky,
-- které teprve vzniknou. Bez něj by se stejná chyba opakovala u každé další
-- migrace a projevila by se zase až v provozu.
--
-- Rolím `anon` a `authenticated` se tady NIC nedává. Ty musí dostávat
-- granty vždycky výslovně a po sloupcích — to je celý smysl migrace 002
-- a důvod, proč je v projektu vypnuté „Automatically expose new tables".
-- ═══════════════════════════════════════════════════════════════════════════

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant all on sequences to service_role;

alter default privileges in schema public
  grant all on functions to service_role;
