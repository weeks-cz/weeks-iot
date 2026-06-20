import { NextRequest, NextResponse } from "next/server";

import { createRateLimiter } from "@/lib/tutor/rate-limit";

export const runtime = "nodejs";

// Anti-spam / cost guard — přísnější než chat, posílání e-mailů je dražší
// a zneužitelnější (5 odeslání za minutu na jednu IP).
const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Allowlist for both `accessUrl` host AND request `Origin` header.
// Tightened from `/\.vercel\.app$/` to a project-prefix regex (audit finding #9):
// only weeks-iot's own Vercel deployments are accepted, not arbitrary third-party
// `*.vercel.app` deployments that an attacker could spin up to phish kids.
const ALLOWED_HOSTS = [
  /\.weeks\.cz$/,
  /^weeks\.cz$/,
  /^localhost(:\d+)?$/,
  /^127\.0\.0\.1(:\d+)?$/,
  /^weeks-iot(-[\w-]+)*\.vercel\.app$/,
];

interface NotifyPayload {
  to?: unknown;
  subject?: unknown;
  body?: unknown;
  accessUrl?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOSTS.some((re) => re.test(host));
}

function isAllowedAccessUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return isAllowedHost(u.host);
  } catch {
    return false;
  }
}

// Origin gate (audit finding #10): browsers send `Origin` automatically on
// cross-origin POSTs and on same-origin POSTs from a different scheme/port.
// Rejecting unknown origins blocks drive-by bots and curl-without-headers
// scanners. Determined attackers can fake the header — this is a soft gate,
// not a security boundary, and is paired with input validation + provider quota.
function isAllowedOrigin(originHeader: string | null): boolean {
  // No Origin header at all → accept (server-to-server callers, healthchecks).
  // The actual abuse vector is browser-driven mass POSTs, which always carry Origin.
  if (!originHeader) return true;
  try {
    const u = new URL(originHeader);
    return isAllowedHost(u.host);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req.headers.get("origin"))) {
    return NextResponse.json({ ok: false, error: "Origin not allowed" }, { status: 403 });
  }

  const rl = limiter.check(clientKey(req), Date.now());
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

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
