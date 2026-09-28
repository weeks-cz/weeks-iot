-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — režim editoru (bloky / kód) u profilu dítěte
--
-- Dřív si ho pamatoval jen prohlížeč. Na jiném počítači tak dítě, které už
-- píše kód, začínalo znovu v blocích, a sourozenci na jednom notebooku si
-- volbu navzájem přepínali.
--
-- NULL = profil si ještě nevybral. Aplikace pak převezme volbu z prohlížeče
-- (dítě, které přešlo na kód před registrací, v něm zůstane) a teprve bez ní
-- ukáže bloky. Výchozí 'blocks' by tu informaci smazal.
--
-- Rolím `anon` a `authenticated` se nic nedává: čte i zapisuje jen server
-- servisní rolí, po ověření, že profil patří přihlášenému účtu. Servisní
-- role sloupec vidí díky tabulkovému grantu z migrace 002/009.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.children
  add column if not exists editor_mode text
  check (editor_mode in ('blocks', 'code'));
