-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — evidence odeslaných e-mailů sekvence
--
-- „Registrace bez follow-upu se do měsíce vypaří." Sekvence má tři kroky
-- a spouští ji cron, který běží jednou denně.
--
-- Bez téhle tabulky by cron při každém běhu poslal totéž znovu — a nic
-- neodradí rychleji než tentýž e-mail třetí den po sobě. Unikátní dvojice
-- (rodič, krok) to znemožňuje na úrovni databáze, ne na úrovni opatrnosti
-- v kódu.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.email_log (
  id         bigserial primary key,
  parent_id  uuid not null references public.parents(id) on delete cascade,
  -- 'welcome' | 'nudge' | 'camp'. Text, ne enum: přidání kroku sekvence
  -- má být změna v kódu, ne migrace.
  step       text not null,
  sent_at    timestamptz not null default now(),
  -- false = Resend zprávu odmítl. Řádek vzniká tak jako tak, aby se
  -- odesílání nezkoušelo donekonečna dokola.
  ok         boolean not null default true,
  error      text,

  unique (parent_id, step)
);

create index email_log_sent_idx on public.email_log (sent_at desc);

comment on table public.email_log is
  'Co komu ze sekvence odešlo. Unikátní (parent_id, step) brání dvojímu odeslání.';

alter table public.email_log enable row level security;

-- Žádný grant pro klienta ani politika: tabulka je čistě serverová,
-- píše a čte ji výhradně cron pod servisní rolí. RLS je zapnuté jako
-- pojistka pro případ, že by někdo grant později přidal.
