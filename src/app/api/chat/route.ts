import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { isAllowedOrigin } from "@/lib/http/allowed-origin";
import { createRateLimiter } from "@/lib/tutor/rate-limit";
import { buildSystemPrompt, type TutorTaskContext } from "@/lib/tutor/prompt";
import { LIMITS, sanitizeText } from "@/lib/tutor/sanitize";

export const runtime = "nodejs";
// AI tutor — krátké odpovědi, ale necháme prostor pro streaming do 30 s.
export const maxDuration = 30;

// Model přes Vercel AI Gateway (string id). Přepínatelné přes env.
const MODEL = process.env.TUTOR_MODEL ?? "anthropic/claude-haiku-4.5";
// Cost guard: tutor má radit krátce, ne psát eseje.
const MAX_OUTPUT_TOKENS = 600;

// Anti-spam / cost guard: 15 dotazů za minutu na jednu IP.
const limiter = createRateLimiter({ limit: 15, windowMs: 60_000 });

interface ChatBody {
  messages?: UIMessage[];
  task?: { title?: unknown; description?: unknown; sectionId?: unknown } | null;
  code?: unknown;
}

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Gateway je nakonfigurovaný buď API klíčem, nebo (na Vercelu) OIDC tokenem.
function gatewayConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function sanitizeTask(task: ChatBody["task"]): TutorTaskContext | undefined {
  if (!task || typeof task !== "object") return undefined;
  const title = sanitizeText(task.title, 200);
  const description = sanitizeText(task.description, LIMITS.code);
  const sectionId = sanitizeText(task.sectionId, 40);
  if (!title && !description) return undefined;
  return { title, description, sectionId };
}

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req.headers.get("origin"))) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const rl = limiter.check(clientKey(req), Date.now());
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Moc dotazů naráz. Dej mi chvilku a zkus to znovu." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Invalid 'messages'" }, { status: 400 });
  }

  if (!gatewayConfigured()) {
    console.warn("[chat] AI gateway není nakonfigurovaný (chybí AI_GATEWAY_API_KEY / OIDC)");
    return NextResponse.json(
      { error: "AI tutor zatím není zapnutý. Zkus to prosím později." },
      { status: 503 },
    );
  }

  // Cost guard: pošleme jen posledních N zpráv konverzace.
  const recentMessages = body.messages.slice(-LIMITS.maxMessages);
  const task = sanitizeTask(body.task);
  const code = sanitizeText(body.code, LIMITS.code);
  const system = buildSystemPrompt({ task, code });

  try {
    const result = streamText({
      model: MODEL,
      system,
      messages: await convertToModelMessages(recentMessages),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
      abortSignal: req.signal,
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[chat] streamText error:", err);
    return NextResponse.json(
      { error: "Tutor teď nemůže odpovědět. Zkus to prosím za chvíli." },
      { status: 502 },
    );
  }
}
