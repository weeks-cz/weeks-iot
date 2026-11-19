import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Podepsaný token odkazu: `<id>.<base64url(hmac-sha256(id))>`.
 * Id řádku `device_link_requests` je UUID, takže token nejde uhodnout
 * ani podvrhnout bez `DEVICE_LINK_SECRET`.
 */

/**
 * Token je vázaný na účel: `open` (odkaz do lekce, může se přeposlat dál)
 * a `unsub` (odhlášení) mají každý jiný podpis. Uniklý odkaz do lekce tak
 * nejde použít k odhlášení a naopak.
 */
export type TokenPurpose = "open" | "unsub";

function mac(id: string, secret: string, purpose: TokenPurpose): Buffer {
  return createHmac("sha256", secret).update(`${purpose}:${id}`).digest();
}

export function signRequestId(
  id: string,
  secret: string,
  purpose: TokenPurpose,
): string {
  return `${id}.${mac(id, secret, purpose).toString("base64url")}`;
}

/** Vrátí id, nebo null při špatném tvaru či podpisu. */
export function verifyRequestToken(
  token: string,
  secret: string,
  purpose: TokenPurpose,
): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const id = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = mac(id, secret, purpose);
  if (given.length !== expected.length) return null;

  return timingSafeEqual(given, expected) ? id : null;
}

/** Fail-closed: bez secretu se žádný odkaz nevydá ani neověří. */
export function requestTokenSecret(): string {
  const secret = process.env.DEVICE_LINK_SECRET?.trim();
  if (!secret) throw new Error("DEVICE_LINK_SECRET není nastaven.");
  return secret;
}
