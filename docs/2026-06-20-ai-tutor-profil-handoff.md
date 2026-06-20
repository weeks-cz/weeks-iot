# Handoff — AI tutor + Profil dítěte (2026-06-20)

Shipnuto na `main` (produkce) v rámci epiků **„Weeks IoT – produkce do srpna 2026"** (Lukášovy `[L]` části). Commity `0e07aa9..a336c7a`.

## Co je hotové a na produkci

### AI tutor (epik „IoT · AI tutor")
- `src/lib/tutor/` — čistá, otestovaná logika (17 vitest testů):
  - `prompt.ts` — system prompt, který **vede, neřeší**; česky, drží téma, bez osobních údajů dítěte.
  - `sanitize.ts` — limity délky vstupu + ořez řídicích znaků.
  - `rate-limit.ts` — in-memory sliding window (anti-spam / cost guard).
- `src/app/api/chat/route.ts` — streamovaný endpoint (AI SDK `streamText`), model přes **Vercel AI Gateway** (`anthropic/claude-haiku-4.5`, přepínatelné `TUTOR_MODEL`). Cost guard: `maxOutputTokens` 600, posledních N zpráv, rate-limit 15/min/IP, origin gate. Bez klíče vrací graceful 503.
- `src/components/task/TutorChat.tsx` — sbalitelný panel mentora v detailu úkolu; posílá kontext (úkol + aktuální kód) per-request.

> **⚠️ Aby tutor naživo odpovídal, nastav ve Vercel env `AI_GATEWAY_API_KEY`** (nebo zapni OIDC pro AI Gateway). Do té doby UI ukáže „AI tutor zatím není zapnutý" — bezpečné pro pre-launch.

### Bezpečnost
- `src/app/api/notify-account/route.ts` — přidán rate-limit (5/min/IP). Dokončuje `[L] Rate-limit /api/notify-account + /api/chat`.

### Profil dítěte (epik „IoT · Účty, profil & cloud sync")
- `src/components/screens/ProfileScreen.tsx` — nová obrazovka: avatar, hvězdy/tokeny, úroveň, postup (X/Y úkolů), splněné úkoly + uložené obvody jako „projekty". Klik na avatar/jméno v hlavičce nově vede na profil; z profilu navigace na avatara, styl a odznaky. Čistě nad `GameState`, žádná nová persistence.

## Poznámka k buildu
`next.config.ts` má `typescript.ignoreBuildErrors` + `eslint.ignoreDuringBuilds` zapnuté (přidáno při „ship dev to production – CAD WIP"). Build proto projde i přes ~54 type chyb v CAD kódu (nekompletní `src/types/wokwi-jsx.d.ts` — deklaruje 9 z ~50 `wokwi-*` prvků; doplnění je Štěpánova rozdělaná práce). Nová tutor/profil práce je otypovaná čistě nezávisle (0 chyb).

## Co dál (Lukášovy zbývající `[L]` části)
- **Platby & Freemium** (Comgate reuse z weeks-web, plány 79/699 → `learning_accounts.plan`, webhook→aktivace, Fakturoid, recurring, server-side paywall přes RLS) — záměrně neděláno autonomně (reálné peníze, externí API, potřebuje creds + testing).
- **Účty/profil/cloud sync** — viz oddělený audit reálného stavu syncu.
- **Security & launch hardening** — RLS revize + retention; „sundat noindex" až těsně před spuštěním.
