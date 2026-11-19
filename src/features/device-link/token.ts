import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Podepsaný token odkazu: `<id>.<base64url(hmac-sha256(id))>`.
 * Id řádku `device_link_requests` je UUID, takže token nejde uhodnout
 * ani podvrhnout bez `DEVICE_LINK_SECRET`.
 */

function mac(id: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(id).digest();
}

export function signRequestId(id: string, secret: string): string {
  return `${id}.${mac(id, secret).toString("base64url")}`;
}

/** Vrátí id, nebo null při špatném tvaru či podpisu. */
export function verifyRequestToken(
  token: string,
  secret: string,
): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const id = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = mac(id, secret);
  if (given.length !== expected.length) return null;

  return timingSafeEqual(given, expected) ? id : null;
}

/** Fail-closed: bez secretu se žádný odkaz nevydá ani neověří. */
export function requestTokenSecret(): string {
  const secret = process.env.DEVICE_LINK_SECRET?.trim();
  if (!secret) throw new Error("DEVICE_LINK_SECRET není nastaven.");
  return secret;
}
