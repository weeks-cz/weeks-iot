# Plán: Učebna v2 — registrace a onboarding

Návrh: `docs/superpowers/specs/2026-08-29-ucebna-v2-registrace-onboarding-design.md`
Větev: `feat/ucebna-v2`

## Fáze A — Základ

- [ ] A1 Přesun legacy do `src/legacy/`, alias `@legacy/*`, kiosek na `/tabor`
- [ ] A2 Tailwind v4 tokeny maker-lab v `globals.css`, fonty, kořenový layout
- [ ] A3 Bezpečnostní hlavičky + CSP v `next.config.ts`, middleware pro session
- [ ] A4 Design systém: Button, Input, Field, Checkbox, Card, Badge, Alert, Stepper

## Fáze B — Databáze

- [ ] B1 Migrace 001: schema (regions, parents, consents, children, courses, lessons, progress, projects, learning_events, city_waitlist)
- [ ] B2 Migrace 002: RLS, sloupcové granty, `owns_child()`, RPC na souhlas
- [ ] B3 Seed: 14 krajů se spádem, kurz IoT, 7 lekcí (metadata, obsah placeholder)
- [ ] B4 Typy z DB, klienti Supabase (browser / server / service)

## Fáze C — Doména

- [ ] C1 `lib/regions` — kraje, spád, segment + testy
- [ ] C2 `features/consent` — znění `parental-v1`, verze, ledger, dotaz na platnost + testy
- [ ] C3 `features/children` — scrypt PIN, ověření, zamčení + testy
- [ ] C4 `features/anon-session` — localStorage relace, UTM, `adoptAnonymousSession` + testy
- [ ] C5 `features/analytics` — události včetně anonymních, zachycení UTM
- [ ] C6 `lib/rate-limit` — omezení bez externí služby (Postgres) + testy

## Fáze D — Auth a onboarding

- [ ] D1 Supabase Auth Hook route + Resend, 4 české šablony ve Weeks brandu
- [ ] D2 `/registrace` — wizard: přihlášení → kraj → dítě → souhlasy
- [ ] D3 `/prihlaseni` — heslo, magic link, Google
- [ ] D4 `/obnova-hesla` + `/auth/callback` rozšířený
- [ ] D5 Přenos anonymního postupu po registraci

## Fáze E — Zóny

- [ ] E1 `/ucet` — přehled, děti, přidání dítěte
- [ ] E2 `/ucet/souhlasy` — historie, odvolání
- [ ] E3 `/ucet/smazat` — smazání s lhůtou
- [ ] E4 `/ucim-se` — přepínač profilu s PINem
- [ ] E5 `/`, `/kurz/[slug]`, `/kurz/[slug]/[lekce]` — kostra s placeholder obsahem, zeď po lekci

## Fáze F — Uzavření

- [ ] F1 `npx tsc --noEmit` čistý pro nový kód, `npm run build`, `npm test`
- [ ] F2 `docs/handoff-ucebna-v2.md` + `docs/metriky-brana-1.sql`
- [ ] F3 Commity po logických celcích
