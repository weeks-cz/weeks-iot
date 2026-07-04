### Task B2: Retention cron pro learning_events

**Files:**
- Create: `src/app/api/cron/retention/route.ts`
- Modify: `vercel.json` (přidat `crons`)
- Test: `src/lib/__tests__/retention.test.ts` + Create: `src/lib/retention.ts`

**Interfaces:**
- Produces: `retentionCutoffIso(now: Date, days?: number): string` (default 365).

- [ ] **Step 1: Failing test**

```typescript
// src/lib/__tests__/retention.test.ts
import { describe, it, expect } from "vitest";
import { retentionCutoffIso } from "@/lib/retention";

describe("retentionCutoffIso", () => {
  it("vrátí ISO datum 365 dní zpět", () => {
    expect(retentionCutoffIso(new Date("2026-07-04T08:00:00Z"))).toBe("2025-07-04T08:00:00.000Z");
  });
  it("respektuje vlastní počet dní", () => {
    expect(retentionCutoffIso(new Date("2026-07-04T08:00:00Z"), 30)).toBe("2026-06-04T08:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run** `npm test -- retention` → FAIL

- [ ] **Step 3: Implementace**

```typescript
// src/lib/retention.ts
/** Cutoff pro mazání starých learning_events (GDPR data-minimisation). */
export function retentionCutoffIso(now: Date, days = 365): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
```

```typescript
// src/app/api/cron/retention/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { retentionCutoffIso } from "@/lib/retention";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const supabase = createClient(url, key);
  const cutoff = retentionCutoffIso(new Date());
  const { error, count } = await supabase
    .from("learning_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count ?? 0, cutoff });
}
```

Do `vercel.json` přidej (zachovej existující obsah — soubor má redirecty pro klicenka.weeks.cz):

```json
"crons": [{ "path": "/api/cron/retention", "schedule": "0 3 * * 0" }]
```

- [ ] **Step 4: Run** `npm test` + `npx tsc --noEmit` → PASS
- [ ] **Step 5: Commit** `feat(security): weekly learning_events retention cron (365d, CRON_SECRET-gated)`

