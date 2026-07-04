export type PaymentStatus = 'paid' | 'cancelled' | 'pending'

/** Comgate accepts price in haléře as an integer (2990 Kč -> 299000). */
export function korunyToHalere(koruny: number): number {
  return Math.round(koruny * 100)
}

/** Map a Comgate status string to our internal payment_status value. */
export function mapComgateStatus(comgateStatus: string): PaymentStatus {
  switch (comgateStatus) {
    case 'PAID':
      return 'paid'
    case 'CANCELLED':
      return 'cancelled'
    default:
      return 'pending'
  }
}

export interface ComgateConfig {
  merchant: string
  secret: string
  test: boolean
  method: string
}

/** Reads Comgate config from env. Throws if required vars are missing. */
export function getComgateConfig(): ComgateConfig {
  const merchant = process.env.COMGATE_MERCHANT
  const secret = process.env.COMGATE_SECRET
  if (!merchant || !secret) {
    throw new Error('Comgate config missing: COMGATE_MERCHANT and COMGATE_SECRET are required.')
  }
  return {
    merchant,
    secret,
    test: process.env.COMGATE_TEST !== 'false',
    method: process.env.COMGATE_METHOD || 'ALL',
  }
}

/** Check if Comgate is configured without throwing. */
export function isComgateConfigured(): boolean {
  return Boolean(process.env.COMGATE_MERCHANT && process.env.COMGATE_SECRET)
}

export interface CreatePaymentInput {
  paymentId: string
  priceKc: number
  label: string
  email: string
  returnBaseUrl: string
}

export function buildCreateParams(input: CreatePaymentInput, cfg: ComgateConfig): URLSearchParams {
  return new URLSearchParams({
    merchant: cfg.merchant,
    secret: cfg.secret,
    price: String(korunyToHalere(input.priceKc)),
    curr: 'CZK',
    label: input.label,
    refId: input.paymentId,
    method: cfg.method,
    email: input.email,
    prepareOnly: 'true',
    test: String(cfg.test),
    lang: 'cs',
    country: 'CZ',
    url_paid: `${input.returnBaseUrl}/premium/dekujeme?paymentId=${input.paymentId}`,
    url_pending: `${input.returnBaseUrl}/premium/dekujeme?paymentId=${input.paymentId}`,
    url_cancelled: `${input.returnBaseUrl}/premium/zruseno`,
  })
}

const CREATE_URL = 'https://payments.comgate.cz/v1.0/create'
const STATUS_URL = 'https://payments.comgate.cz/v1.0/status'

export interface CreateResult {
  transId: string
  redirect: string
}

export function parseCreateResponse(body: string): CreateResult {
  const params = new URLSearchParams(body)
  const code = params.get('code')
  if (code !== '0') {
    throw new Error(`Comgate create failed: code=${code} message=${params.get('message') ?? ''}`)
  }
  const transId = params.get('transId')
  const redirect = params.get('redirect')
  if (!transId || !redirect) {
    throw new Error('Comgate create response missing transId or redirect')
  }
  return { transId, redirect }
}

/** Comgate includes the merchant secret in its callback; verify it matches ours. */
export function verifyCallbackIdentity(params: URLSearchParams, cfg: ComgateConfig): boolean {
  return params.get('secret') === cfg.secret && params.get('merchant') === cfg.merchant
}

export async function createPayment(input: CreatePaymentInput, cfg = getComgateConfig()): Promise<CreateResult> {
  const res = await fetch(CREATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: buildCreateParams(input, cfg).toString(),
  })
  return parseCreateResponse(await res.text())
}

export async function getStatus(transId: string, cfg = getComgateConfig()): Promise<PaymentStatus> {
  const res = await fetch(STATUS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ merchant: cfg.merchant, secret: cfg.secret, transId }).toString(),
  })
  const params = new URLSearchParams(await res.text())
  if (params.get('code') !== '0') {
    throw new Error(`Comgate status failed: code=${params.get('code')} message=${params.get('message') ?? ''}`)
  }
  return mapComgateStatus(params.get('status') ?? '')
}
