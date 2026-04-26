import type { NotifyAccountPayload, ValidationResult } from "@/types";
import { isValidEmail, normalizeEmail } from "./validation";

function buildAccountAccessUrl(email: string): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  // Pin the deep link to topic-select + email prefill, dropping any other params.
  const out = new URL(url.origin + url.pathname);
  out.searchParams.set("screen", "topics");
  out.searchParams.set("email", email);
  return out.toString();
}

function buildAccountCreatedEmail(email: string): NotifyAccountPayload {
  const accessUrl = buildAccountAccessUrl(email);
  return {
    to: email,
    subject: "Tvůj přístup do Weeks IoT je připravený",
    body:
      `Ahoj!\n\n` +
      `Účet pro IoT tábor je vytvořený. Pro pokračování použij odkaz níže — ` +
      `otevře se příští krok (výběr tématu) přímo z tvé schránky:\n`,
    accessUrl,
  };
}

export async function notifyAccountCreated(rawEmail: string): Promise<ValidationResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return { ok: false, message: "Zadej prosím platnou e-mailovou adresu." };
  }
  const payload = buildAccountCreatedEmail(email);
  try {
    const res = await fetch("/api/notify-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { ok: false, message: "E-mail se nepodařilo odeslat. Zkus to za chvíli znovu." };
    }
    return { ok: true, message: "E-mail s odkazem byl odeslán." };
  } catch (err) {
    console.warn("[account-email] fetch failed:", err);
    return { ok: false, message: "Síťová chyba — odkaz neodešel." };
  }
}
