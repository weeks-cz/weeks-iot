## Global Constraints

- **Žádné nové dependencies.** Zod se NEpřidává — validace custom funkcemi (vzor `src/lib/validation.ts`). Stripe se nepoužívá (rozhodnuto: Comgate).
- **Nesahat na CAD soubory** (`src/components/cad/**`, `src/lib/cad/**`, `src/types/wokwi-jsx.d.ts`) — Štěpánova rozdělaná práce. `ignoreBuildErrors` v `next.config.ts` nechat jak je.
- **Nová práce = 0 type chyb** (`npx tsc --noEmit` bude hlásit jen známé CAD chyby; žádná nová nesmí přibýt).
- **UI copy česky, tykání** (appka mluví na děti); e-maily rodičům vykání.
- **Ceny vždy server-side**: 79 Kč / 699 Kč definované jen v `src/lib/payments/plans.ts`, klient nikdy neposílá částku.
- **Comgate částky v haléřích** (79 Kč = 7900).
- **`vat_rate: 0`** ve Fakturoidu (Lukáš = neplátce DPH, IČO 24878511).
- **`learning_accounts.plan` nesmí být zapisovatelný klientem** — jen service role (column-level grants, Task B1/C1).
- Testy: `npm test` (vitest, testy v `src/**/__tests__/`). Commity konvenční (`feat:`, `fix:`, `chore:`), Co-Authored-By Claude.
- Guest/PIN (táborový) režim zůstává beze změny: hvězdičkové odemykání sekcí, žádný paywall. Paywall se týká jen email-propojených účtů.

## Kontext — co už je hotové (neopakovat)
