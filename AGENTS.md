<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Weeks Učebna

Výuková platforma pro děti 10–15 let na `ucebna.weeks.cz`. Není to samostatný
byznys — je to trychtýř na letní tábory Weeks, který si na sebe vydělá
předplatným.

**Uživatel je dítě, plátce je rodič.** Platební zeď proto nikdy nestojí mezi
dítětem a obsahem. Stojí mezi rodičem a důkazem.

Rozhodovací dokumenty nejsou v repozitáři — leží jako `.docx`
v `C:\Users\lukol\Downloads\` s prefixem `Weeks - `. Návrh a plán aktuálního
přepisu jsou v `docs/superpowers/`.

## Dvě aplikace v jednom repozitáři

| | Kde | Stav |
|---|---|---|
| Nová učebna | `src/app/(public\|auth\|parent\|child)/`, `src/features/`, `src/lib/` | vyvíjí se |
| Táborový kiosek | `src/legacy/`, routa `/tabor` | **zamrazený** |

`src/legacy/` je port táborového kiosku a přepisuje se, ne opravuje. Sahej do
něj jen tehdy, když měníš táborový režim. Používá alias `@legacy/*`; nová
aplikace `@/*`.

## Struktura nové aplikace

Vertikální řezy podle domény, ne vrstvy. Každý řez v `src/features/<název>/`
drží `schema.ts` (Zod), `actions.ts` (`"use server"`), `queries.ts`,
`components/` a `__tests__/`.

Důvod: audit vytýkal `page.tsx` na 2 300 řádcích. Soubor, který se nevejde do
hlavy, se nevejde ani do kontextu.

## Pravidla, která se v tomhle projektu porušují nejsnáz

**Zápis jen přes Server Actions se Zod validací.** Klient nikdy neposílá ID,
která si může vymyslet — slugy se překládají na ID na serveru.

**Bezpečnostní hranicí je grant v databázi, ne kód.** `pin_hash` a sloupce
rozhodující o předplatném nemá role `authenticated` v grantu. Když přidáváš
tabulku, přidej i RLS politiku a sloupcové granty do migrace.

**Souhlasy jsou append-only.** Odvolání je nový řádek s `granted = false`,
nikdy update. Kdo mění znění v `src/features/consent/texts.ts`, MUSÍ zvýšit
`version` — jinak vzniknou dva různé souhlasy pod stejným označením.

**Anonymní relace nesmí nic poslat na server.** Do okamžiku, kdy rodič odešle
registraci, žije postup výhradně v `localStorage`. Je to právní stav, ne
optimalizace.

**Anonym měří stejně jako přihlášený.** Bez `lesson_start` od anonyma
neexistuje jmenovatel hlavní metriky a brána 1 se nedá vyhodnotit.

**Odemykání obsahu za hvězdičky se nezavádí.** Je to překážka postavená přímo
do metriky, kterou maximalizujeme.

## Pasti, které tenhle projekt už jednou stály čas

- **Řádky databáze musí být `type`, ne `interface`.** Interface nemá implicitní
  index signature, neprojde `Record<string, unknown>` uvnitř `GenericSchema`
  a supabase-js pak vyhodnotí všechny tabulky jako `never`. Projeví se to jako
  „not assignable to parameter of type never" u každého `.insert()`.
- **`"use server"` soubor smí exportovat jen async funkce.** Konstanty a typy
  patří vedle, jinak spadne build.
- **Čisté pomocné funkce nepatří vedle přístupu k databázi.** Klientská
  komponenta si jedním importem přitáhne serverový Supabase klient do
  prohlížeče. `src/lib/supabase/server.ts` má proto `server-only`.
- **React 19 přesunul `JSX` namespace do modulu `react`.** Augmentace přes
  `declare global { namespace JSX }` se tiše ignoruje.
- **Řídicí znaky v regexu piš jako `\x00`, ne doslovně.** Doslovné jsou
  neviditelné a při normalizaci se tiše ztratí.
- **Tailwind v4 nemá `tailwind.config.ts`.** Konfigurace žije inline
  v `src/app/globals.css` pod `@theme`.

## Design

Maker lab — technický výkres, ne dětská grafika. Portováno z
`weeks_web@design/maker-lab`. Bricolage Grotesque na nadpisy, Instrument Sans
na text, IBM Plex Mono na čísla a technická metadata. Tvrdé stíny místo
měkkých, `rounded-md` místo `rounded-2xl`.

Dvě hlasitosti, jeden systém: dětská zóna vzdušná a barevná, rodičovská zóna
a auth kompaktní a střízlivá. Rodič tam dává souhlas a platí kartou.

Amber je vyhrazená hlavní akci. Dvě amber tlačítka na jedné obrazovce znamenají,
že jedno z nich je špatně.

Mobile-first od 320 px. Dotykové cíle minimálně 44 px.

## Před commitem

```bash
npx tsc --noEmit    # musí být čistý pro nový kód
npm test            # 162 testů
npm run build       # odhalí úniky server→klient, které tsc nevidí
```

`npm run lint` hlásí chyby i v `src/legacy/` — ty jsou známé a zamrazené.
V novém kódu musí být lint čistý.
