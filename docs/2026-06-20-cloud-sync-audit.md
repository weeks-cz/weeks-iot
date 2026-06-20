# Cloud sync — audit reálného stavu (2026-06-20)

Deliverable pro `[L] Dotáhnout cloud sync — nejdřív ověřit reálný stav`. Audit kódu (`src/lib/cloud-sync.ts`, `GameStateProvider.tsx`, `src/types`, migrace).

## Jak to funguje dnes
- **Synchronizují se jen email-propojení uživatelé** (`state.linkedUserId`). PIN/guest studenti = pouze localStorage (ztráta při vymazání zařízení — by design pro tábor).
- **Push**: debounce 1 s po jakékoli změně → `upsert` do `learning_accounts.state` (JSONB), anon klíč + RLS (`auth.uid() = id`). Beforeunload flush (best-effort).
- **Eventy**: `learning_events` insert pro task_complete, skip, unlock, purchase, daily, signup, login.

## Co se synchronizuje vs. ne (před fixem)
| Pole | Stav |
|---|---|
| account, tasks, sections | ✅ push i pull |
| circuits | ⚠️ pushovaly se nahoru, ale **nestahovaly** zpět (CLOUD_HYDRATE je zahazoval) |
| **codeDrafts (kód dítěte)** | ❌ **vůbec se nesynchronizovaly** → ztráta kódu při přechodu na jiné zařízení |
| config (PINy, ceny) | ❌ local-only (záměrně) |
| multi-student (PIN) data | ❌ local-only (žádná cloud identita) |

## ✅ Opraveno v této session (commit v této větvi)
- `codeDrafts` přidány do `SyncableState` + `extractSyncableState` (push) **i** do `CLOUD_HYDRATE` (pull).
- `circuits` se nyní na `CLOUD_HYDRATE` **stahují zpět** (dříve jen push). Oboje s fallbackem na lokální stav u starých řádků (zpětně kompatibilní, JSONB = bez migrace).

Výsledek: kód i obvody dítěte teď přežijí přihlášení na jiném zařízení.

## 🔴 Zbývá (pro Lukáše — větší/designová rozhodnutí)
1. **Konflikty / last-write-wins** (`[L] Řešení konfliktů syncu`): `upsert` nemá kontrolu `updated_at`/verze. Dvě otevřené záložky/zařízení se můžou navzájem přepsat. Fix: optimistic locking (porovnat `updated_at`) nebo JSONB merge.
2. **Validace cloud stavu na hydrate**: data se mergují bez validace — poškozený/ručně editovaný JSONB může appku rozbít. Fix: zod schema, při neúspěchu fallback na default.
3. **Stale-closure v beforeunload flush**: rychlá změna + zavření záložky může flushnout starý snapshot. Fix: `useRef` na poslední stav, nebo immediate sync u kritických akcí (task complete).
4. **circuit_save se neemituje jako event** (analytics slepé místo).
5. **Multi-student (PIN) bez cloudu**: zdokumentovat, že PIN režim je pouze lokální; varovat při propojení účtu, že PIN data se nepřenášejí.
