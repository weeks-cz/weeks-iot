### Task C4: Fakturoid + e-mail klient (přenos)

**Files:**
- Create: `src/lib/payments/fakturoid.ts` (kopie `weeks_web/src/lib/fakturoid.ts` + úpravy)
- Create: `src/lib/payments/email.ts` (jen `sendEmail` + nový builder)
- Test: `src/lib/payments/__tests__/fakturoid.test.ts`

**Interfaces:**
- Produces: `isFakturoidConfigured()`, `issuePaidInvoice(p: InvoiceParams): Promise<string>` s `InvoiceParams = { billingName: string; billingEmail: string; paymentId: string; planLabel: string; priceKc: number; sendEmail: boolean }`; `sendEmail({ to, subject, html })`, `buildPremiumConfirmationEmail({ planLabel, priceKc, expiresAtIso }): { subject; html }`, `isEmailConfigured()`.

- [ ] **Step 1: Zkopíruj fakturoid.ts a uprav `InvoiceParams`** — místo registračních polí: `billingName`, `billingEmail`, `paymentId` (→ `custom_id` subjektu), `planLabel`, `priceKc`. Řádek faktury: `{ name: planLabel, quantity: "1", unit_name: "ks", unit_price: String(priceKc), vat_rate: 0 }`. OAuth flow, token cache, mark-paid, message endpoint beze změny.
- [ ] **Step 2: Vytvoř email.ts** — zkopíruj `isEmailConfigured` + `sendEmail` z `weeks_web/src/lib/email.ts` a přidej builder:

```typescript
export function buildPremiumConfirmationEmail(p: {
  planLabel: string; priceKc: number; expiresAtIso: string;
}): { subject: string; html: string } {
  const until = new Date(p.expiresAtIso).toLocaleDateString("cs-CZ");
  return {
    subject: "Potvrzení platby — Weeks Premium",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2>Děkujeme za platbu</h2>
        <p>Předplatné <strong>${p.planLabel}</strong> (${p.priceKc} Kč) je aktivní
        do <strong>${until}</strong>.</p>
        <p>Dítě má nyní odemčené všechny sekce v aplikaci
        <a href="https://iot.weeks.cz">iot.weeks.cz</a>. Daňový doklad posíláme
        v samostatném e-mailu.</p>
        <p>Tým Weeks<br>admin@weeks.cz</p>
      </div>`,
  };
}
```

- [ ] **Step 3: Test builderu payloadů** (vzor `weeks_web/src/lib/fakturoid.test.ts`): `buildInvoicePayload` má `vat_rate: 0`, správný `unit_price`, `buildSubjectPayload` má `custom_id = paymentId`. Run → PASS.
- [ ] **Step 4: Run** `npx tsc --noEmit` → čisté; **Commit** `feat(payments): fakturoid + resend clients (premium invoicing)`

