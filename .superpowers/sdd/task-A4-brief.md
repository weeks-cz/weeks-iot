### Task A4: PIN režim = local-only varování

**Files:**
- Modify: `src/components/screens/LinkAccountModal.tsx`

- [ ] **Step 1: Přidej infobox do modalu** (pod taby, nad formulář — stylem šedý info panel konzistentní s existujícím `setMsg` UI):

```tsx
<p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
  💡 Do cloudu se ukládá jen postup tohoto propojeného účtu. Táborové PIN
  profily zůstávají uložené jen v tomhle zařízení a propojením se nepřenášejí.
</p>
```

(Přizpůsob třídy okolnímu stylu modalu — použij stejné barvy/radius jako existující hlášky v souboru.)

- [ ] **Step 2: Vizuální kontrola** `npm run dev` → TaskList → „Propojit“ → text viditelný ve všech třech tabech.
- [ ] **Step 3: Commit** `docs(ux): PIN profiles are local-only — warning in LinkAccountModal`

---

