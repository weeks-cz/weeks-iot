-- ═══════════════════════════════════════════════════════════════════════════
-- Učebna v2 – žádosti rodičů o odkaz na počítač (stránka /pro-rodice)
--
-- ── Proč ───────────────────────────────────────────────────────────────────
-- Rodič přijde z reklamy na telefonu, ale emulátor obvodů se dá dobře ovládat
-- jen na počítači. Stránka /pro-rodice proto nabídne poslat si odkaz na
-- první lekci e-mailem. Žádost je výslovný úkon rodiče; na server jde jen
-- e-mail, zdroj návštěvy a souhlas. Žádné anon_id a nic z postupu v lekci.
--
-- ── Co se mění ─────────────────────────────────────────────────────────────
-- 1. device_link_requests – jedna žádost = jeden řádek. Čistě serverová
--    tabulka: RLS zapnuté, žádná politika, žádný grant pro anon ani
--    authenticated. Zapisuje výhradně Server Action pod servisní rolí
--    (default privileges z migrace 009 jí práva dají samy).
--    - email je nullable: po anonymizaci (řádek bez platného souhlasu
--      starší 90 dní) se smaže a řádek zůstane jako statistika. Check
--      zajistí, že e-mail chybí jen u anonymizovaného řádku.
--    - verified_at = první otevření odkazu NA JAKÉMKOLI zařízení: důkaz, že
--      majitel schránky e-mail dostal. Telefon se sem počítá.
--    - opened_at = první otevření odkazu NA POČÍTAČI. Otevření na telefonu
--      se sem nezapisuje a připomínku nezruší.
--    - marketing_consent = aktuální stav; doklad je v ledgeru consents.
-- 2. consents.device_link_request_id – souhlas daný při odeslání formuláře
--    (a jeho odvolání odhlašovacím odkazem) se váže na žádost. Ledger zůstává
--    append-only. `on delete set null`: smazání žádosti ledger nestrhne
--    (stejná logika jako u účtu, migrace 013).
--
-- ── Nasazení ───────────────────────────────────────────────────────────────
-- Spustit PŘED nasazením kódu. Bez této migrace formulář na /pro-rodice
-- nemá kam zapsat; kód počítá s tím, že tabulka existuje.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.device_link_requests (
  id                uuid primary key default gen_random_uuid(),
  email             citext,
  -- Původ návštěvy, ze které rodič formulář odeslal (z attribution).
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  utm_term          text,
  referrer          text,
  -- 'facebook' | 'instagram' | 'browser' (analytics/environment.ts)
  env               text,
  marketing_consent boolean not null default false,
  -- Kdy odešel e-mail s odkazem; NULL = odeslání selhalo (viz send_error).
  sent_at           timestamptz,
  send_error        text,
  -- První otevření odkazu na jakémkoli zařízení (telefon taky): majitel
  -- schránky e-mail opravdu dostal.
  verified_at       timestamptz,
  -- První otevření odkazu na počítači. Telefon se sem nezapisuje.
  opened_at         timestamptz,
  reminder_sent_at  timestamptz,
  unsubscribed_at   timestamptz,
  anonymized_at     timestamptz,
  created_at        timestamptz not null default now(),
  constraint device_link_requests_email_or_anonymized
    check ((email is not null) or (anonymized_at is not null))
);

-- Rate limit a vyhledání podle adresy (case-insensitive).
create index device_link_requests_email_idx
  on public.device_link_requests (lower(email::text), created_at desc);

-- Tabulka je čistě serverová. Bez politik a bez grantu pro anon/authenticated
-- se k ní klient nedostane; RLS je pojistka pro případ, že by grant někdo
-- později přidal.
alter table public.device_link_requests
  enable row level security;

alter table public.consents
  add column device_link_request_id uuid
    references public.device_link_requests(id) on delete set null;

create index consents_device_link_request_idx
  on public.consents (device_link_request_id, created_at desc)
  where device_link_request_id is not null;
