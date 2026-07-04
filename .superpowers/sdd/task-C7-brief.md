### Task C7: Plan do klienta (hydrate) + paywall UI

**Files:**
- Modify: `src/types/index.ts` — `GameState` + akce `CLOUD_HYDRATE`
- Modify: `src/lib/cloud-sync.ts` — `fetchCloudState` čte i `plan, plan_expires_at`
- Modify: `src/components/providers/GameStateProvider.tsx` — hydrate ukládá plan
- Modify: `src/components/screens/TaskList.tsx` — gating zamčených sekcí
- Create: `src/components/screens/UpgradeModal.tsx`

**Interfaces:**
- `GameState` gains: `plan?: "free" | "student"; planExpiresAt?: string | null;` — **NEpatří do `SyncableState`** (server-owned, nikdy se nepushuje).
- `CloudSnapshot` gains: `plan: string | null; planExpiresAt: string | null;`
- `CLOUD_HYDRATE` action gains: `plan?: string | null; planExpiresAt?: string | null;`
- UI helper: `hasPremium(state.plan, state.planExpiresAt)` z `@/lib/payments/plans` (čistá funkce, client-safe).

- [ ] **Step 1: fetchCloudState** — `select("state, updated_at, plan, plan_expires_at")`, vrať v `CloudSnapshot`. V GameStateProvider hydrate effectu předej do dispatch `plan: fresh.plan, planExpiresAt: fresh.planExpiresAt`; v reduceru `CLOUD_HYDRATE` ulož `plan: (action.plan === "student" ? "student" : "free")`, `planExpiresAt: action.planExpiresAt ?? null`.
- [ ] **Step 2: TaskList gating** — u zamčené sekce s `unlockCost`:

```tsx
const premium = hasPremium(state.plan, state.planExpiresAt);
const effectiveUnlocked = section.unlocked || (Boolean(state.linkedUserId) && premium);
// ...
{!effectiveUnlocked && section.unlockCost !== undefined && (
  state.linkedUserId && !premium ? (
    <button onClick={() => setUpgradeOpen(true)} /* styl dle existujícího unlock buttonu */>
      <Lock className="h-4 w-4" />
      Odemkni {section.label} s Weeks Premium
    </button>
  ) : (
    /* původní hvězdičkový unlock button beze změny (PIN/guest režim) */
  )
)}
```

Přesné umístění: existující blok „Unlock CTA row for locked sections“ (~ř. 200–215). Premium uživatel sekce vidí odemčené (obsah dostupný), hvězdičkové odemykání pro něj mizí.

- [ ] **Step 3: UpgradeModal** — nová komponenta (vzor modal struktury: `LinkAccountModal.tsx`):
  - výběr období: dvě karty — „79 Kč / měsíc“ a „699 Kč / rok (ušetříš 249 Kč)“, default roční;
  - input „Jméno rodiče (na doklad)“ (volitelný);
  - text: „Platbu zadává rodič. Po zaplacení se všechny sekce odemknou hned.“;
  - submit: vezmi access token (`supabase.auth.getSession()` přes existující `createClient` z `@/lib/supabase/client`), `fetch("/api/payment/create", { method: "POST", headers: { "content-type": "application/json", authorization: \`Bearer ${token}\` }, body: JSON.stringify({ period, billingName }) })`;
  - 200 → `window.location.href = redirectUrl`; 503 → hláška „Platby zatím nejsou zapnuté — zkus to prosím později.“; jiná chyba → obecná hláška.
- [ ] **Step 4: Return stránky**
  - Create `src/app/premium/dekujeme/page.tsx`: „Díky! Platba se zpracovává. Premium se aktivuje během chvilky — stačí se vrátit do aplikace.“ + tlačítko „Zpět do aplikace“ (`href="/"`). (Hydrate při načtení appky stáhne čerstvý `plan`.)
  - Create `src/app/premium/zruseno/page.tsx`: „Platba byla zrušena. Nic jsme ti neúčtovali.“ + „Zpět do aplikace“.
  - Obě stránky: jednoduchý layout, `robots: { index: false }` v metadata.
- [ ] **Step 5: Run** `npm test` + `npx tsc --noEmit` → čisté; `npm run dev` vizuální kontrola paywall CTA (nastav si dočasně `linkedUserId` mockem nebo přihlášením).
- [ ] **Step 6: Commit** `feat(paywall): premium plan in client state + upgrade modal + return pages`

