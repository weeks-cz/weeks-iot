// Fakturoid API v3 client (Client Credentials Flow — single account, server→server).
// Issues a paid invoice (daňový doklad o úhradě) after a Comgate payment settles.
// Account is a NON-VAT payer (neplátce DPH) → all lines use vat_rate 0.
//
// Docs: https://www.fakturoid.cz/api/v3

const API_BASE = 'https://app.fakturoid.cz/api/v3'

export interface FakturoidConfig {
  slug: string
  clientId: string
  clientSecret: string
  userAgent: string
}

function getConfig(): FakturoidConfig | null {
  const slug = process.env.FAKTUROID_SLUG
  const clientId = process.env.FAKTUROID_CLIENT_ID
  const clientSecret = process.env.FAKTUROID_CLIENT_SECRET
  const userAgent = process.env.FAKTUROID_USER_AGENT || 'Weeks IoT (admin@weeks.cz)'
  if (!slug || !clientId || !clientSecret) return null
  return { slug, clientId, clientSecret, userAgent }
}

export function isFakturoidConfigured(): boolean {
  return getConfig() !== null
}

// ── Pure, testable payload builders ─────────────────────────────────────────

export interface InvoiceParams {
  billingName: string
  billingEmail: string
  paymentId: string
  planLabel: string
  priceKc: number
  sendEmail: boolean
}

export function buildSubjectPayload(p: InvoiceParams) {
  return {
    name: p.billingName,
    email: p.billingEmail,
    country: 'CZ',
    // custom_id lets us find the subject again in the Fakturoid UI by payment.
    custom_id: p.paymentId,
  }
}

export function buildInvoicePayload(subjectId: number, p: InvoiceParams) {
  return {
    subject_id: subjectId,
    lines: [
      {
        name: p.planLabel,
        quantity: '1',
        unit_name: 'ks',
        unit_price: String(p.priceKc),
        vat_rate: 0, // neplátce DPH
      },
    ],
  }
}

/** YYYY-MM-DD for today, server timezone. */
export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

// ── HTTP layer ───────────────────────────────────────────────────────────────

// In-memory access-token cache (per server instance). Tokens live 2 h; we refresh
// a minute early.
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(cfg: FakturoidConfig, now = Date.now()): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token
  }
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': cfg.userAgent,
    },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) {
    throw new Error(`Fakturoid token failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number }
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 7200) * 1000,
  }
  return cachedToken.token
}

async function apiFetch(
  cfg: FakturoidConfig,
  token: string,
  path: string,
  init: RequestInit
): Promise<Response> {
  return fetch(`${API_BASE}/accounts/${cfg.slug}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': cfg.userAgent,
      ...(init.headers ?? {}),
    },
  })
}

/** Verifies credentials by fetching an access token. No data is created. */
export async function verifyConnection(): Promise<{ ok: boolean; detail?: string }> {
  const cfg = getConfig()
  if (!cfg) return { ok: false, detail: 'not configured' }
  try {
    await getAccessToken(cfg)
    return { ok: true }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Create a subject + paid invoice for a settled payment. Returns the
 * Fakturoid invoice id. Throws on any API error so the caller can release its
 * idempotency claim and retry later.
 */
export async function issuePaidInvoice(p: InvoiceParams): Promise<string> {
  const cfg = getConfig()
  if (!cfg) throw new Error('Fakturoid not configured')
  const token = await getAccessToken(cfg)

  // 1. Subject (customer)
  const subjectRes = await apiFetch(cfg, token, '/subjects.json', {
    method: 'POST',
    body: JSON.stringify(buildSubjectPayload(p)),
  })
  if (!subjectRes.ok) {
    throw new Error(`Fakturoid subject failed: ${subjectRes.status} ${await subjectRes.text()}`)
  }
  const subject = (await subjectRes.json()) as { id: number }

  // 2. Invoice
  const invoiceRes = await apiFetch(cfg, token, '/invoices.json', {
    method: 'POST',
    body: JSON.stringify(buildInvoicePayload(subject.id, p)),
  })
  if (!invoiceRes.ok) {
    throw new Error(`Fakturoid invoice failed: ${invoiceRes.status} ${await invoiceRes.text()}`)
  }
  const invoice = (await invoiceRes.json()) as { id: number; number: string }

  // 3. Mark paid (full-amount payment auto-sets status to paid)
  const payRes = await apiFetch(cfg, token, `/invoices/${invoice.id}/payments.json`, {
    method: 'POST',
    body: JSON.stringify({ paid_on: todayIso() }),
  })
  if (!payRes.ok) {
    throw new Error(`Fakturoid payment failed: ${payRes.status} ${await payRes.text()}`)
  }

  // 4. Email the document to the customer (paid plans only → best-effort).
  if (p.sendEmail) {
    try {
      const msgRes = await apiFetch(cfg, token, `/invoices/${invoice.id}/message.json`, {
        method: 'POST',
        body: JSON.stringify({}), // use account email defaults
      })
      if (!msgRes.ok) {
        console.error(`[fakturoid] message failed: ${msgRes.status} ${await msgRes.text()}`)
      }
    } catch (e) {
      console.error('[fakturoid] message error (non-fatal):', e)
    }
  }

  return String(invoice.id)
}
