### Task C3: Comgate klient (přenos z weeks-web)

**Files:**
- Create: `src/lib/payments/comgate.ts` (kopie `weeks_web/src/lib/comgate.ts` + úpravy níže)
- Test: `src/lib/payments/__tests__/comgate.test.ts`

**Interfaces:**
- Produces: `getComgateConfig()`, `isComgateConfigured(): boolean`, `korunyToHalere(n)`, `mapComgateStatus(s): "paid"|"cancelled"|"pending"`, `buildCreateParams(input, cfg)`, `parseCreateResponse(body)`, `verifyCallbackIdentity(params, cfg)`, `createPayment(input, cfg?): Promise<{ transId, redirect }>`, `getStatus(transId, cfg?)`.
- `CreatePaymentInput` přizpůsobený: `{ paymentId: string; priceKc: number; label: string; email: string; returnBaseUrl: string }`.

- [ ] **Step 1: Zkopíruj a uprav klienta**

```bash
cp /c/Users/lukol/Downloads/weeks_web/src/lib/comgate.ts src/lib/payments/comgate.ts
```

Úpravy:
1. `CreatePaymentInput`: odstraň `registrationId`, `locationId`, `confirmToken`; přidej `paymentId: string`. `refId` = `input.paymentId`.
2. Return URLs v `buildCreateParams`:
   - `url_paid` a `url_pending` → `${returnBaseUrl}/premium/dekujeme?paymentId=${input.paymentId}`
   - `url_cancelled` → `${returnBaseUrl}/premium/zruseno`
3. Přidej `export function isComgateConfigured(): boolean { return Boolean(process.env.COMGATE_MERCHANT && process.env.COMGATE_SECRET); }` (vzor graceful 503 z tutor route).
4. Odstraň refund funkce (`buildRefundParams`, `refundPayment`) — YAGNI pro MVP, storna ručně přes Comgate portál.
5. Endpointy, `korunyToHalere`, `mapComgateStatus`, `parseCreateResponse`, `verifyCallbackIdentity`, `prepareOnly: 'true'`, `lang: 'cs'` — beze změny.

- [ ] **Step 2: Failing test**

```typescript
// src/lib/payments/__tests__/comgate.test.ts
import { describe, it, expect } from "vitest";
import {
  korunyToHalere, mapComgateStatus, buildCreateParams,
  parseCreateResponse, verifyCallbackIdentity,
} from "@/lib/payments/comgate";

const cfg = { merchant: "m1", secret: "s1", test: true, method: "ALL" };
const input = {
  paymentId: "pay-123", priceKc: 79, label: "Weeks Premium — měsíční",
  email: "rodic@example.cz", returnBaseUrl: "https://iot.weeks.cz",
};

describe("comgate client (subscription variant)", () => {
  it("převádí Kč na haléře", () => {
    expect(korunyToHalere(79)).toBe(7900);
    expect(korunyToHalere(699)).toBe(69900);
  });
  it("mapuje stavy", () => {
    expect(mapComgateStatus("PAID")).toBe("paid");
    expect(mapComgateStatus("CANCELLED")).toBe("cancelled");
    expect(mapComgateStatus("PENDING")).toBe("pending");
    expect(mapComgateStatus("cokoliv")).toBe("pending");
  });
  it("staví create params s refId=paymentId a cenou v haléřích", () => {
    const p = buildCreateParams(input, cfg);
    expect(p.get("refId")).toBe("pay-123");
    expect(p.get("price")).toBe("7900");
    expect(p.get("curr")).toBe("CZK");
    expect(p.get("prepareOnly")).toBe("true");
    expect(p.get("url_paid")).toBe("https://iot.weeks.cz/premium/dekujeme?paymentId=pay-123");
    expect(p.get("url_cancelled")).toBe("https://iot.weeks.cz/premium/zruseno");
  });
  it("parsuje create response", () => {
    const r = parseCreateResponse("code=0&message=OK&transId=AB12-CD34-EF56&redirect=https%3A%2F%2Fpayments.comgate.cz%2Fx");
    expect(r.transId).toBe("AB12-CD34-EF56");
    expect(r.redirect).toBe("https://payments.comgate.cz/x");
  });
  it("ověří identitu callbacku", () => {
    const ok = new URLSearchParams({ merchant: "m1", secret: "s1" });
    const bad = new URLSearchParams({ merchant: "m1", secret: "zle" });
    expect(verifyCallbackIdentity(ok, cfg)).toBe(true);
    expect(verifyCallbackIdentity(bad, cfg)).toBe(false);
  });
});
```

(Před psaním asercí zkontroluj skutečné signatury ve zkopírovaném souboru — testy weeks-web `comgate.test.ts` můžeš použít jako referenci pro přesné tvary response parsingu.)

- [ ] **Step 3: Run** `npm test -- comgate` → PASS (po doladění úprav z kroku 1)
- [ ] **Step 4: Run** `npx tsc --noEmit` → žádné nové chyby
- [ ] **Step 5: Commit** `feat(payments): comgate client adapted from weeks-web (subscription flow)`

