import { NextResponse } from "next/server";
import { z } from "zod";
import { sendTemplate } from "@/lib/email/send";
import {
  confirmSignupEmail,
  emailChangeEmail,
  inviteEmail,
  magicLinkEmail,
  reauthenticationEmail,
  recoveryEmail,
  type EmailTemplate,
} from "@/lib/email/templates";
import { verifyWebhookSignature } from "@/lib/email/webhook";

/**
 * Supabase Send Email Hook.
 *
 * Supabase si dál vlastní tokeny a jejich platnost; my přebíráme jen
 * odeslání. Díky tomu žijí české šablony ve Weeks brandu v gitu místo
 * v dashboardu, dají se revidovat v pull requestu a nikdo je omylem
 * nepřepíše klikáním.
 *
 * Zapnout v Supabase: Authentication → Hooks → Send Email Hook,
 * URL `<doména>/api/auth/email`, secret do SUPABASE_AUTH_HOOK_SECRET.
 */

export const runtime = "nodejs";
/* Bez tohohle by se odpověď mohla cachovat. U endpointu, který rozesílá
   jednorázové tokeny, by to bylo velmi špatně. */
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  user: z.object({ email: z.string().email() }),
  email_data: z.object({
    token: z.string().default(""),
    token_hash: z.string(),
    redirect_to: z.string().default(""),
    email_action_type: z.string(),
    site_url: z.string().default(""),
  }),
});

/**
 * Sestavení ověřovacího odkazu.
 *
 * Míří na Supabase, ne na naši aplikaci — token vyměňuje za session
 * Supabase a teprve pak přesměruje na `redirect_to`.
 */
function verificationUrl(
  tokenHash: string,
  actionType: string,
  redirectTo: string,
): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const url = new URL(`${base}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

function templateFor(actionType: string, url: string, token: string): EmailTemplate | null {
  switch (actionType) {
    case "signup":
      return confirmSignupEmail(url);
    case "magiclink":
      return magicLinkEmail(url);
    case "recovery":
      return recoveryEmail(url);
    case "invite":
      return inviteEmail(url);
    case "email_change":
    case "email_change_new":
      return emailChangeEmail(url);
    case "reauthentication":
      return reauthenticationEmail(token);
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!secret) {
    console.error("[auth/email] Chybí SUPABASE_AUTH_HOOK_SECRET");
    return NextResponse.json({ error: "Hook není nakonfigurovaný" }, { status: 500 });
  }

  /* Tělo se musí číst jako text, ne přes .json(). Podpis se počítá přesně
     z bajtů, které dorazily — po JSON.parse a znovu-serializaci by se
     lišilo pořadí klíčů i mezery a podpis by nikdy neseděl. */
  const rawBody = await request.text();

  const verification = verifyWebhookSignature(rawBody, request.headers, secret);
  if (!verification.ok) {
    console.warn("[auth/email] Odmítnuto:", verification.reason);
    /* 401 bez detailu. Kdo podpis netrefil, nemá se dozvědět proč. */
    return NextResponse.json({ error: "Neplatný podpis" }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    console.error("[auth/email] Neočekávaný tvar payloadu");
    return NextResponse.json({ error: "Neplatný payload" }, { status: 400 });
  }

  const { user, email_data: data } = parsed.data;
  const url = verificationUrl(data.token_hash, data.email_action_type, data.redirect_to);
  const template = templateFor(data.email_action_type, url, data.token);

  if (!template) {
    console.error(`[auth/email] Neznámý typ akce: ${data.email_action_type}`);
    /* 200 schválně: Supabase by jinak zkoušel znovu a znovu u typu, který
       nikdy neobsloužíme. Chyba patří do logu, ne do fronty opakování. */
    return NextResponse.json({ skipped: data.email_action_type });
  }

  const result = await sendTemplate(user.email, template);
  if (!result.ok) {
    /* Tady naopak 500 chceme — je to dočasná chyba a opakování dává smysl. */
    return NextResponse.json({ error: "Odeslání selhalo" }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}
