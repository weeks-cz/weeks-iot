### Task A2: Fix stale-closure v beforeunload flushi

**Files:**
- Modify: `src/components/providers/GameStateProvider.tsx` (beforeunload effect, ~ř. 642–650)

**Interfaces:** Consumes `syncToCloud(state, expectedUpdatedAt)` a existující `cloudVersionRef`.

- [ ] **Step 1: Přepiš effect na ref**

Nahraď:

```typescript
useEffect(() => {
  if (!state.linkedUserId) return;
  const handler = () => { void syncToCloud(state, cloudVersionRef.current); };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [state]);
```

za (ref se aktualizuje každý render, listener se registruje jednou):

```typescript
const latestStateRef = useRef(state);
useEffect(() => { latestStateRef.current = state; });

useEffect(() => {
  const handler = () => {
    const s = latestStateRef.current;
    if (!s.linkedUserId) return;
    void syncToCloud(s, cloudVersionRef.current);
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, []);
```

(`useRef` už je v souboru importovaný — ověř; jinak přidej do react importu.)

- [ ] **Step 2: Run** `npm test` + `npx tsc --noEmit` → beze změn/nových chyb
- [ ] **Step 3: Manuální smoke:** `npm run dev`, propojený účet, změna stavu + okamžité zavření tabu → řádek v `learning_accounts` má čerstvý stav (best-effort, stačí ověřit že handler čte z refu).
- [ ] **Step 4: Commit** `fix(cloud-sync): beforeunload flush reads latest state via ref (stale closure)`

