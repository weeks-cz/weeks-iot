import "server-only";
import { Resend } from "resend";
import { renderEmail, renderEmailText } from "./layout";
import type { EmailTemplate } from "./templates";

/**
 * Odesílání přes Resend.
 *
 * Klient se vyrábí líně. Kdyby vznikal na úrovni modulu, spadl by build
 * všude, kde klíč zatím není — třeba na preview větvi.
 */

let client: Resend | null = null;

function resend(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("Chybí RESEND_API_KEY");
    client = new Resend(key);
  }
  return client;
}

function sender(): string {
  return process.env.EMAIL_FROM?.trim() || "Weeks Učebna <ucebna@weeks.cz>";
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendTemplate(to: string, template: EmailTemplate): Promise<SendResult> {
  try {
    const { error } = await resend().emails.send({
      from: sender(),
      to,
      subject: template.subject,
      html: renderEmail(template.content),
      /* Textová verze není zdvořilost: bez ní hodnotí část filtrů zprávu
         jako podezřelou a přihlašovací odkaz skončí ve spamu. */
      text: renderEmailText(template.content),
      headers: {
        /* Transakční e-mail nemá být ve vlákně s předchozím. Bez toho je
           Gmail sbalí a druhý přihlašovací odkaz se schová pod prvním. */
        "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      },
    });

    if (error) {
      console.error("[email] Resend odmítl zprávu:", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "neznámá chyba";
    console.error("[email] Odeslání selhalo:", message);
    return { ok: false, error: message };
  }
}
