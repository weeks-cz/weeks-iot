-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — záznam o souhlasu přežije smazání účtu
--
-- ── Chyba, kterou to opravuje ──────────────────────────────────────────────
-- consents.parent_id měl `on delete cascade`. Smazání účtu tak strhlo i ledger,
-- zatímco /ochrana-udaju (i text souhlasu zákonného zástupce, bod 6) slibuje,
-- že záznam o souhlasu zůstane i po zrušení účtu jako doklad.
--
-- ── Co se změní ────────────────────────────────────────────────────────────
-- Smazání rodiče odpojí jeho řádky ledgeru (parent_id = NULL), nesmaže je.
-- Zůstane druh souhlasu, verze, plné znění, granted, čas, IP a user agent —
-- tedy přesně to, co má text souhlasu v bodě 9 („záznam o souhlasu“).
-- Řádky se nadále nikdy neupravují ani nemažou z aplikace; odpojení dělá
-- Postgres sám při smazání řádku v parents.
--
-- ── Nasazení ───────────────────────────────────────────────────────────────
-- Migraci spustit PŘED nasazením kódu, který se opírá o nový ledger. Dokud
-- neběží, smazání účtu dál funguje, ale záznamy se smažou kaskádou (stav
-- před touto migrací).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.consents alter column parent_id drop not null;

alter table public.consents drop constraint consents_parent_id_fkey;

alter table public.consents
  add constraint consents_parent_id_fkey
  foreign key (parent_id) references public.parents(id) on delete set null;
