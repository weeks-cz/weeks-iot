### Task A1: Validace cloud stavu při hydrate

Poškozený/ručně editovaný JSONB v `learning_accounts.state` nesmí rozbít appku. Validace v jediném choke pointu: `fetchCloudState()`.

**Files:**
- Create: `src/lib/cloud-validate.ts`
- Test: `src/lib/__tests__/cloud-validate.test.ts`
- Modify: `src/lib/cloud-sync.ts` (funkce `fetchCloudState`)

**Interfaces:**
- Produces: `sanitizeCloudState(raw: unknown): SyncableState | null` — `null` = neopravitelné (hydrate se přeskočí, vyhraje lokální stav a první push cloud přepíše); jinak vyčištěný stav s fallbacky pro volitelná pole.

- [ ] **Step 1: Failing test**

```typescript
// src/lib/__tests__/cloud-validate.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeCloudState } from "@/lib/cloud-validate";

const validAccount = {
  avatarId: "fox", stars: 5, tokens: 2,
  unlockedThemes: ["default"], unlockedAvatars: ["fox"],
  currentTheme: "default", dailyChallengeDate: null, levelBadges: [],
};
const valid = {
  account: validAccount,
  tasks: { "task-1": { status: "done" } },
  sections: { beginner: { unlocked: true } },
  circuits: {},
  codeDrafts: { "task-1": "print(1)" },
};

describe("sanitizeCloudState", () => {
  it("propustí validní stav beze změny", () => {
    expect(sanitizeCloudState(valid)).toEqual(valid);
  });
  it("vrátí null pro ne-objekty", () => {
    expect(sanitizeCloudState(null)).toBeNull();
    expect(sanitizeCloudState("x")).toBeNull();
    expect(sanitizeCloudState([1])).toBeNull();
  });
  it("vrátí null když chybí/nesedí account.stars", () => {
    expect(sanitizeCloudState({ ...valid, account: { ...validAccount, stars: "hodně" } })).toBeNull();
    expect(sanitizeCloudState({ ...valid, account: null })).toBeNull();
  });
  it("vrátí null když tasks/sections nejsou objekty", () => {
    expect(sanitizeCloudState({ ...valid, tasks: 7 })).toBeNull();
    expect(sanitizeCloudState({ ...valid, sections: "no" })).toBeNull();
  });
  it("nahradí nevalidní volitelná pole prázdnými objekty", () => {
    const out = sanitizeCloudState({ ...valid, circuits: "corrupt", codeDrafts: 42 });
    expect(out).not.toBeNull();
    expect(out!.circuits).toEqual({});
    expect(out!.codeDrafts).toEqual({});
  });
  it("ořízne neznámé klíče na root úrovni", () => {
    const out = sanitizeCloudState({ ...valid, __proto__pollution: { hack: 1 }, extra: 1 });
    expect(out).toEqual(valid);
  });
});
```

- [ ] **Step 2: Run** `npm test -- cloud-validate` → FAIL (modul neexistuje)

- [ ] **Step 3: Implementace**

```typescript
// src/lib/cloud-validate.ts
import type { SyncableState } from "@/types";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Obranná validace JSONB stavu z cloudu před CLOUD_HYDRATE / CLOUD_RECONCILE.
 * `null` = stav je neopravitelný → volající hydrate přeskočí (lokální stav vyhrává).
 * Volitelná pole (circuits, codeDrafts) se při poškození nahradí `{}` místo zahození celku.
 */
export function sanitizeCloudState(raw: unknown): SyncableState | null {
  if (!isRecord(raw)) return null;
  const { account, tasks, sections, circuits, codeDrafts } = raw;
  if (!isRecord(account) || !isRecord(tasks) || !isRecord(sections)) return null;
  if (typeof account.stars !== "number" || typeof account.tokens !== "number") return null;
  if (typeof account.avatarId !== "string" || typeof account.currentTheme !== "string") return null;
  if (!Array.isArray(account.unlockedThemes) || !Array.isArray(account.unlockedAvatars)) return null;
  return {
    account: account as SyncableState["account"],
    tasks: tasks as SyncableState["tasks"],
    sections: sections as SyncableState["sections"],
    circuits: isRecord(circuits) ? (circuits as SyncableState["circuits"]) : {},
    codeDrafts: isRecord(codeDrafts) ? (codeDrafts as SyncableState["codeDrafts"]) : {},
  };
}
```

- [ ] **Step 4: Run** `npm test -- cloud-validate` → PASS

- [ ] **Step 5: Zapoj do fetchCloudState** (`src/lib/cloud-sync.ts`)

Nahraď závěr funkce `fetchCloudState`:

```typescript
  if (!data) return null;
  return { state: data.state as SyncableState, updatedAt: data.updated_at as string };
```

za:

```typescript
  if (!data) return null;
  const clean = sanitizeCloudState(data.state);
  if (!clean) {
    console.warn("[cloud-sync] cloud state failed validation — skipping hydrate");
    return null;
  }
  return { state: clean, updatedAt: data.updated_at as string };
```

a přidej import `import { sanitizeCloudState } from "@/lib/cloud-validate";`.

- [ ] **Step 6: Run** `npm test` + `npx tsc --noEmit` (žádné nové chyby) → PASS

- [ ] **Step 7: Commit** `fix(cloud-sync): validate cloud state on hydrate (corrupt JSONB fallback)`

