import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_ORIGINS = [
  /\.weeks\.cz$/,
  /^localhost(:\d+)?$/,
  /^127\.0\.0\.1(:\d+)?$/,
  /\.vercel\.app$/,
];

interface NotifyPayload {
  to?: unknown;
  subject?: unknown;
  body?: unknown;
  accessUrl?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAllowedAccessUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return ALLOWED_ORIGINS.some((re) => re.test(u.host));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let payload: NotifyPayload;
  try {
    payload = (await req.json()) as NotifyPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { to, subject, body, accessUrl } = payload;

  if (typeof to !== "string" || !EMAIL_RE.test(to)) {
    return NextResponse.json({ ok: false, error: "Invalid 'to'" }, { status: 400 });
  }
  if (typeof subject !== "string" || subject.length === 0 || subject.length > 200) {
    return NextResponse.json({ ok: false, error: "Invalid 'subject'" }, { status: 400 });
  }
  if (typeof body !== "string" || body.length === 0 || body.length > 5000) {
    return NextResponse.json({ ok: false, error: "Invalid 'body'" }, { status: 400 });
  }
  if (typeof accessUrl !== "string" || !isAllowedAccessUrl(accessUrl)) {
    return NextResponse.json({ ok: false, error: "Invalid 'accessUrl'" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ACCOUNT_EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[notify-account] missing RESEND_API_KEY or ACCOUNT_EMAIL_FROM — accepting silently in dev");
    return NextResponse.json({ ok: true, delivered: false, reason: "no transport configured" });
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
      subject,
      text: `${body}\n\n${accessUrl}\n`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[notify-account] resend error:", res.status, detail);
    return NextResponse.json({ ok: false, error: "Email transport failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, delivered: true });
}
