### Task C9: Finální verifikace + PR

- [ ] **Step 1:** `npm test` (vše zelené) + `npx tsc --noEmit` (jen známé CAD chyby) + `npm run build` (projde díky ignoreBuildErrors, ale nesmí spadnout na runtime chybách).
- [ ] **Step 2:** `npm run dev` smoke: appka nastartuje, TaskList funguje v guest režimu, /premium/dekujeme + /premium/zruseno se renderují, /api/payment/create vrací 503 bez credů.
- [ ] **Step 3:** Push větve `feat/iot-lukas-batch` na origin (`gh auth` jako lukoluko8 — viz memory reference_git_push_auth) + PR do `main` repa weeks-cz/weeks-iot se souhrnem per epik.
- [ ] **Step 4:** Aktualizovat hub kanban (Supabase qtxiwt…): komentáře k epikům „Účty/sync“, „Security“, „Platby“ se stavem a odkazem na PR.
