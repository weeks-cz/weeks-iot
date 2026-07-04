// Resend transactional email for weeks-iot premium subscriptions.
// Domain weeks.cz is verified in Resend (eu-west-1). From defaults to a real
// inbox so replies reach the team.

const RESEND_URL = 'https://api.resend.com/emails'

interface EmailConfig {
  apiKey: string
  from: string
}

function getConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return {
    apiKey,
    from: process.env.RESEND_FROM || 'Weeks <info@weeks.cz>',
  }
}

export function isEmailConfigured(): boolean {
  return getConfig() !== null
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
  replyTo?: string
}): Promise<void> {
  const cfg = getConfig()
  if (!cfg) throw new Error('Resend not configured (RESEND_API_KEY missing)')
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: cfg.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo || 'info@weeks.cz',
    }),
  })
  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`)
  }
}

// ── Templates (pure, testable) ────────────────────────────────────────────────

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
