# v2 Security & Code Audit Findings

## Summary

This document records findings from the audit performed during the v2 Next.js refactor of `lxkask/weeks-iot`. Severity is assessed relative to the app's purpose (educational tablet app for kids at IoT camps) and deployment context (pre-production preview, `noindex`, no PII collection beyond optional self-submitted email).

The audit covered: every occurrence of `innerHTML`/`dangerouslySetInnerHTML`/`eval`/`document.write` in `src/` (none — all DOM coupling was rewritten as React JSX during the port), every `localStorage.*` call (wrapped in `storage.ts` with try/catch + version reset), every regex pattern in `STRICT_TASK_RULES` (manually scanned for catastrophic backtracking — none), and every input branch on `/api/notify-account` (replayed crafted payloads against the dev server, all 4xx without invoking the email transport).

## Findings Table

| # | Finding | Severity | Status | Notes |
|---|---------|----------|--------|-------|
| 1 | Client-side PINs (daily/lecturer/admin) visible in bundle | Info | Accepted | Not a security boundary. Documented in `src/lib/config.ts` and `src/lib/pin.ts`. Upgrade in v3 via backend session. |
| 2 | `buildDailyPin` falls back to fixed `DEFAULT_CONFIG.dailyPin` (`"123"`) when `DAILY_ACCESS_MODE === "manual"` | Info | Accepted | Same scope as #1. Date-based mode rotates daily; current "manual" mode is intentional for camp use (lecturer announces the PIN verbally). |
| 3 | `innerHTML` / `dangerouslySetInnerHTML` / `eval` / `document.write` usages | N/A | Fixed in v2 | Manual grep over `src/` returned 0 matches. All step4n's `container.innerHTML = …` patterns were rewritten as React JSX during the port. The legacy `&#127942;` HTML-entity icons in `LEVEL_BADGES` were converted to literal Unicode emoji. |
| 4 | Outfit font served via `next/font/google` | Info | Fixed in v2 | `next/font` self-hosts the font at build time. No third-party request from the browser at runtime — eliminates SRI / CDN-tampering concerns. |
| 5 | `localStorage` read corruption → app crash | Medium | Fixed in v2 | `src/lib/storage.ts` `loadGameState()` wraps `JSON.parse` in try/catch and resets to default state on error. Version mismatch (`parsed.version !== CONFIG_VERSION`) also resets. `saveGameState()` returns `{ ok, error }` instead of throwing. |
| 6 | `STRICT_TASK_RULES` regexes potentially ReDoS-prone | Low | Accepted | Manual scan of all 19 task rule arrays in `src/lib/strict-rules.ts` shows only bounded character classes (`\s*`, `\d+`, literal tokens). No nested quantifiers, no overlapping alternations. User input is also normalized to ≤ a few KB by the textarea before reaching the matcher. |
| 7 | No CSP header configured | Low | Deferred to v3 | Vercel's defaults are safe for a no-third-party-embed app. Add when introducing weeks-hub iframe or other embeds. |
| 8 | `/api/notify-account` accepts unauthenticated POST | Medium | Pre-cutover gate | See finding #9. Same root cause. |
| 9 | `/api/notify-account` `accessUrl` allowlist `/\.vercel\.app$/` admits ANY `*.vercel.app` deployment | Medium | **Pre-cutover gate** | The allowlist permits `attacker-fake-weeks.vercel.app` as a valid back-link in account-confirmation emails. Original Task 7a code-review flagged this; deferred per project lead's call to ship verbatim plan code and tighten before public cutover. **Resolution before cutover (Task 37):** restrict allowlist to a specific project-prefix pattern, e.g. `/^weeks-iot(-[\w-]+)?\.vercel\.app$/`, OR drop `vercel.app` entirely once the production domain `iot.weeks.cz` is live. |
| 10 | `/api/notify-account` could relay outbound email at attacker-controlled rate | Medium | **Pre-cutover gate** | No per-IP rate limiting; no shared-secret header. An attacker discovering the route can burn the Resend free-tier quota or use it to enumerate-and-spam. **Resolution before cutover (Task 37):** add either (a) a `X-Notify-Secret` header check matching a Vercel-env secret the v2 client knows, OR (b) Vercel-edge-rate-limit (`@vercel/kv` sliding window @ 5 req/min/IP). Per-IP enforcement also handles bot scanning. |
| 11 | Email transport secret (`RESEND_API_KEY`) lives in Vercel env | Info | Accepted | Standard pattern. Documented in `.env.local.example`. Never logged. The route's 502 handler logs `console.error("[notify-account] resend error:", res.status, detail)` — `detail` is Resend's response body which may include rate-limit info, never the secret itself. |
| 12 | URL params `?email=` and `?screen=topics` are user-controllable | Low | Fixed in v2 | `?email=` is exposed via `useGameState().emailFromUrl` and only **prefills the form input** in `PinEntry.tsx` — never auto-submits, never written to state until form submit. `?screen=topics` only resets `selectedTopic` to `null` (forcing the topic-select gate). Both are string-typed and `normalizeEmail()`-ed before any use. |
| 13 | `noUncheckedIndexedAccess: true` enabled in `tsconfig.json` | N/A | Fixed in v2 | Catches `state.tasks[id]` access bugs at compile time. Shipped before any `src/lib/` code was written; all reducers and selectors guard against `undefined`. |
| 14 | LocalStorage key bumped from `iot-camp-screen-state` → `iot-camp-screen-state-v6` | Info | Accepted | Old per-pilot saves are orphaned. Plan acknowledges: "no migration; these are pre-prod pilot users." Documented in `src/lib/config.ts`. |
| 15 | `TEST_MODE` seeds new accounts with `TEST_BALANCE` (80⭐, 6 tokens) | Info | Accepted | Gated by `process.env.NEXT_PUBLIC_TEST_MODE === "1"`. Read at build time; unset on Vercel production env → never triggers in production. Documented in `src/lib/config.ts`. |

## What is / isn't a security boundary

**IS a security boundary:**
- TLS on the production domain (Vercel-managed)
- `X-Robots-Tag: noindex, nofollow` on every response (set in `vercel.json`)
- The `accessUrl` allowlist on `/api/notify-account` (with finding #9 caveat)
- Input validation on `/api/notify-account` (`to`, `subject`, `body`, `accessUrl` all type/length-checked before transport)
- Server-side env vars (`RESEND_API_KEY`, `ACCOUNT_EMAIL_FROM`) — never sent to the client

**IS NOT a security boundary:**
- Any PIN in client JS (daily, lecturer, admin) — assume kids will find these in DevTools
- Section unlocks, star costs, help-card costs, theme/avatar purchases — all client-enforced game mechanics, not authentication
- The `/api/notify-account` route's `to:` field — input-validated as a syntactically-valid email but **not verified** to belong to the requester. Treat the route as a low-quota best-effort notifier, not as identity proof.
- The `accountEmail` field in `GameState` — set after a successful API call but represents only "this browser submitted that string", not "this kid owns that mailbox".

## Recommendations for v3

- If per-kid accounts with progress sync are introduced: move state to Supabase Auth + RLS-protected `progress` table; PINs become OTP via email/SMS.
- If weeks-hub integration: introduce service tokens, never expose in client. Use Supabase RLS or weeks-hub's existing JWT.
- If a CMS for tasks: admin UI requires `@weeks.cz` Google OAuth (matches weeks-hub pattern).
- If public launch outside camps: add CSP, HSTS preload, subresource integrity for any CDN assets.
- Tighten `/api/notify-account` `vercel.app` allowlist to project-prefix pattern (see finding #9).
- Add per-IP rate limiting on `/api/notify-account` (see finding #10).
- Consider replacing `STRICT_TASK_RULES` regex matching with a proper Arduino tokenizer to eliminate ReDoS surface entirely (defensive, not currently exploited).

## Audit methodology

- `grep` over `src/` for `innerHTML`, `dangerouslySetInnerHTML`, `eval(`, `document.write` → 0 matches in code paths (only one comment reference in `src/lib/rewards.ts`).
- Traced every `localStorage.*` call (only in `src/lib/storage.ts`) for try/catch handling.
- Ran `npm audit --omit=dev` (see snapshot below).
- Reviewed regex patterns in `src/lib/strict-rules.ts` (19 task rule arrays) for ReDoS risk.
- Replayed `/api/notify-account` against the local dev server with: valid payload, malformed JSON, non-email `to:`, hostile `accessUrl` (`https://evil.com/phish`), oversized body. All non-valid inputs returned `4xx` without invoking the Resend transport.
- Verified `tsconfig.json` strictness flags: `strict: true`, `noUncheckedIndexedAccess: true`, `noFallthroughCasesInSwitch: true`.

## `npm audit` snapshot

Run on commit `ed31f3c` (v2-nextjs branch), 2026-04-26:

```
2 moderate severity vulnerabilities

postcss <8.5.10  (transitive via next@16.2.4 → next/dist/...)
  Severity: moderate
  Advisory: GHSA-qx2v-qp2m-jg93 (XSS via unescaped </style>)
  Auto-fix: would downgrade next → 9.3.3 (BREAKING — REJECTED)
```

**Decision:** accept these two transitive findings. Both come from a `postcss` bundle Next.js itself uses internally for build-time compilation; the vulnerable code path is server-side build, not runtime. The auto-fix recommends a 7-major-version downgrade of Next.js, which is a non-starter. Track upstream Next.js for a release that bumps its bundled `postcss`. No production runtime impact.

