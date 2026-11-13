/**
 * Jak si rodič účet založil: e-mailem s heslem, nebo přes Google.
 *
 * Supabase zapisuje do `app_metadata.provider` poskytovatele PRVNÍ identity
 * účtu. Když si rodič se založeným e-mailovým účtem později propojí Google,
 * `provider` zůstane „email“ a Google přibude jen do `providers` — a to je
 * přesně to, co tu chceme: způsob registrace, ne poslední přihlášení.
 */

export type SignUpMethod = "email" | "google";

export function signUpMethod(
  user: { app_metadata?: { provider?: unknown } | null } | null | undefined,
): SignUpMethod {
  return user?.app_metadata?.provider === "google" ? "google" : "email";
}
