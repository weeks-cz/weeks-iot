import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Ověření podpisu Standard Webhooks.
 *
 * Supabase Auth Hook podepisuje požadavky podle standardwebhooks.com.
 * Bez ověření by kdokoli mohl na náš endpoint poslat cizí adresu a nechat
 * si na ni doručit přihlašovací odkaz — endpoint pro odesílání e-mailů
 * s tokeny je přesně to, co se ověřuje vždycky.
 *
 * Podepisuje se `${id}.${timestamp}.${body}` klíčem HMAC-SHA256, výsledek
 * v base64. Hlavička `webhook-signature` může nést víc podpisů oddělených
 * mezerou (rotace klíče) ve tvaru `v1,<base64>`.
 */

/** Tolerance k rozdílu hodin. Brání přehrání staré, odchycené zprávy. */
const MAX_SKEW_SECONDS = 5 * 60;

export interface WebhookVerification {
  ok: boolean;
  reason?: string;
}

function decodeSecret(secret: string): Buffer {
  /* Supabase ukazuje klíč jako `v1,whsec_<base64>`. Uživatel ho může vložit
     s prefixem i bez něj, takže se sundává, když tam je. */
  const cleaned = secret.replace(/^v1,\s*/, "").replace(/^whsec_/, "");
  return Buffer.from(cleaned, "base64");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  /* timingSafeEqual vyhazuje při rozdílné délce, což by samo o sobě byl
     únik informace. Délku proto porovnáváme zvlášť a předem. */
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyWebhookSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): WebhookVerification {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");

  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "Chybí hlavičky podpisu" };
  }

  const sentAt = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(sentAt)) {
    return { ok: false, reason: "Neplatné časové razítko" };
  }

  const skew = Math.abs(Math.floor(Date.now() / 1000) - sentAt);
  if (skew > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "Časové razítko mimo toleranci" };
  }

  let key: Buffer;
  try {
    key = decodeSecret(secret);
    if (key.length === 0) return { ok: false, reason: "Prázdný podepisovací klíč" };
  } catch {
    return { ok: false, reason: "Podepisovací klíč nejde dekódovat" };
  }

  const expected = createHmac("sha256", key)
    .update(`${id}.${sentAt}.${rawBody}`)
    .digest("base64");

  /* Rotace klíče znamená víc podpisů v jedné hlavičce. Stačí, když sedí
     jeden — a všechny se projdou i po nálezu shody, aby doba běhu
     neprozradila, který to byl. */
  let matched = false;
  for (const part of signature.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    if (safeEqual(value, expected)) matched = true;
  }

  return matched ? { ok: true } : { ok: false, reason: "Podpis nesedí" };
}
