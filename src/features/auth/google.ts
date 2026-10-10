/**
 * Pomocné funkce pro přihlášení Googlem (Google Identity Services).
 *
 * Čistá část bez DOMu: nonce. Google dostane HASH nonce a ten se později
 * objeví v ID tokenu; Supabase dostane SUROVÝ nonce a hash si spočítá sám.
 * Ověří se tak, že token vznikl pro tohle přihlášení, a ne že ho někdo
 * podstrčil z jiné relace (replay). Pořadí je tedy: raw → hash → Google,
 * raw → Supabase. Kdo pošle Supabase hash, dostane chybu nonce.
 */

/** Surový nonce: 32 náhodných bajtů jako hex. Žije jen v paměti stránky. */
export function generateRawNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** SHA-256 surového nonce jako hex — tohle jde do Google. */
export async function hashNonce(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
