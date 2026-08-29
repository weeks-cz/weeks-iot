-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 — omezování četnosti
--
-- Postgres místo Redisu: na náš objem stačí a je to o jednu závislost méně,
-- kterou by šlo zapomenout nakonfigurovat v produkci. Redis dává smysl až
-- tehdy, kdy se počítadlo stane úzkým hrdlem — teď by to byla složitost
-- bez užitku.
--
-- Okno je pevné (fixed window), ne klouzavé. Na hranici oken to teoreticky
-- pustí dvojnásobek limitu; u ochrany profilu dítěte před sourozencem
-- a u registračního formuláře je to naprosto dostačující a je to o řád
-- jednodušší než klouzavý log.
-- ═══════════════════════════════════════════════════════════════════════════

/**
 * Zaznamená pokus a vrátí, kolik jich v okně zbývá.
 *
 * Atomicita stojí na `insert ... on conflict do update` — dva souběžné
 * požadavky se nemůžou přečíst navzájem staré počítadlo a oba projít.
 * Návratová hodnota je počet pokusů VČETNĚ tohoto.
 */
create or replace function public.bump_rate_limit(
  p_bucket    text,
  p_window_ms integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_hits         integer;
begin
  -- Začátek okna: čas zaokrouhlený dolů na násobek délky okna. Díky tomu
  -- mají všechny požadavky ve stejném okně identický klíč.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) * 1000 / p_window_ms) * p_window_ms / 1000
  );

  insert into public.rate_limits (bucket, window_start, hits)
  values (p_bucket, v_window_start, 1)
  on conflict (bucket, window_start)
    do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  return v_hits;
end $$;

revoke all on function public.bump_rate_limit from public, anon, authenticated;
grant execute on function public.bump_rate_limit to service_role;

/** Úklid. Volá cron; bez něj tabulka roste donekonečna. */
create or replace function public.prune_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.rate_limits
   where window_start < now() - interval '24 hours';
  get diagnostics removed = row_count;
  return removed;
end $$;

revoke all on function public.prune_rate_limits from public, anon, authenticated;
grant execute on function public.prune_rate_limits to service_role;
