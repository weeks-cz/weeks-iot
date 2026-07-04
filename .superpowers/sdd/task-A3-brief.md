### Task A3: Event `circuit_save`

**Files:**
- Modify: `src/types/index.ts` (union `LearningEventType`)
- Modify: `src/components/providers/GameStateProvider.tsx` (místo, kde se emitují eventy po dispatch — najdi existující volání `emitEvent(` a vzor pro `task_complete`)

- [ ] **Step 1: Rozšiř union**

```typescript
export type LearningEventType =
  | "signup" | "login"
  | "task_complete" | "task_skip"
  | "section_unlock"
  | "theme_purchase" | "avatar_purchase"
  | "daily_challenge_claim"
  | "circuit_save";
```

- [ ] **Step 2: Emituj při SAVE_CIRCUIT**

V GameStateProvideru najdi wrapper, který po akcích emituje eventy (grep `emitEvent(`). Přidej větev pro `SAVE_CIRCUIT` podle vzoru `task_complete`:

```typescript
if (action.type === "SAVE_CIRCUIT" && !state.adminPreviewActive) {
  void emitEvent(state.linkedUserId ?? null, {
    event_type: "circuit_save",
    task_id: action.taskId,
    metadata: { components: action.circuit.components?.length ?? null },
  });
}
```

(`emitEvent` sám no-opuje pro `userId === null`, PIN režim tedy nic neposílá. Pokud typ `Circuit` nemá pole `components`, metadata vynech — ověř v `src/types`.)

- [ ] **Step 3: Run** `npm test` + `npx tsc --noEmit` → PASS
- [ ] **Step 4: Commit** `feat(analytics): emit circuit_save learning event`

