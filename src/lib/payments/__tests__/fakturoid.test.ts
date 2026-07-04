import { describe, it, expect } from 'vitest'
import { buildSubjectPayload, buildInvoicePayload, todayIso, type InvoiceParams } from '../fakturoid'

const params: InvoiceParams = {
  billingName: 'Jan Novák',
  billingEmail: 'jan@example.cz',
  paymentId: 'pay-abc-123',
  planLabel: 'Weeks Premium — měsíční',
  priceKc: 299,
  sendEmail: false,
}

describe('buildSubjectPayload', () => {
  it('maps billing data and sets custom_id to the payment id', () => {
    const s = buildSubjectPayload(params)
    expect(s.name).toBe('Jan Novák')
    expect(s.email).toBe('jan@example.cz')
    expect(s.country).toBe('CZ')
    expect(s.custom_id).toBe('pay-abc-123')
  })
})

describe('buildInvoicePayload', () => {
  it('builds a single zero-VAT line (neplátce DPH) with the plan label', () => {
    const inv = buildInvoicePayload(42, params)
    expect(inv.subject_id).toBe(42)
    expect(inv.lines).toHaveLength(1)
    const line = inv.lines[0]!
    expect(line.name).toBe('Weeks Premium — měsíční')
    expect(line.quantity).toBe('1')
    expect(line.unit_name).toBe('ks')
    expect(line.unit_price).toBe('299')
    expect(line.vat_rate).toBe(0)
  })

  it('converts price correctly to string', () => {
    const inv = buildInvoicePayload(1, { ...params, priceKc: 699 })
    expect(inv.lines[0]!.unit_price).toBe('699')
  })
})

describe('todayIso', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(todayIso(new Date('2026-08-01T10:30:00Z'))).toBe('2026-08-01')
  })
})
