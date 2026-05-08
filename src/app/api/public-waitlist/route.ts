import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PublicWaitlistPayload {
  email?: unknown;
}

export async function POST(req: NextRequest) {
  let payload: PublicWaitlistPayload;
  try {
    payload = (await req.json()) as PublicWaitlistPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ACCOUNT_EMAIL_FROM;
  const to = process.env.PUBLIC_WAITLIST_TO || "info@weeks.cz";
  const hubUrl = process.env.WEEKS_HUB_API_URL;
  const hubKey = process.env.WEEKS_HUB_API_KEY;

  let hubSynced = false;
  if (hubUrl && hubKey) {
    try {
      const hubRes = await fetch(`${hubUrl.replace(/\/$/, "")}/api/form-submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": hubKey,
        },
        body: JSON.stringify({
          form_type: "contact",
          email,
          sender_name: "Zájemce o veřejnou Weeks Učebnu",
          message:
            "Zájem o vydání Weeks Učebny pro veřejnost. " +
            "Zdroj: waitlist formulář ve weeks-iot / veřejný vstup do Učebny.",
        }),
      });

      if (!hubRes.ok) {
        const detail = await hubRes.text();
        console.error("[public-waitlist] Weeks Hub sync failed:", hubRes.status, detail);
      } else {
        hubSynced = true;
      }
    } catch (error) {
      console.error("[public-waitlist] Weeks Hub sync error:", error);
    }
  }

  if (!apiKey || !from) {
    console.warn("[public-waitlist] missing RESEND_API_KEY or ACCOUNT_EMAIL_FROM — accepting silently in dev", { email });
    return NextResponse.json({ ok: true, delivered: false, hubSynced, reason: "no transport configured" });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Nový zájemce o veřejnou Weeks Učebnu",
      text: `Nový zájemce o vydání Weeks Učebny pro veřejnost:\n\n${email}\n`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[public-waitlist] resend error:", res.status, detail);
    return NextResponse.json({ ok: false, error: "Email transport failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, delivered: true, hubSynced });
}
