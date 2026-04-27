import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Allow only same-origin relative paths starting with a single "/" (e.g. "/" or "/task-list").
// Reject "//evil.com", "/\\evil.com", absolute URLs, anything with a colon, etc.
function isSafeNextPath(next: string): boolean {
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//") || next.startsWith("/\\")) return false;
  // Reject any URL with a scheme (https://, javascript:, data:, ...)
  if (/^\/[a-z]+:/i.test(next)) return false;
  return true;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next = rawNext && isSafeNextPath(rawNext) ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.warn("[auth/callback] exchangeCodeForSession failed:", error.message);
  }

  // exchange selhal nebo chybí code — zpět na login s flagem
  return NextResponse.redirect(`${origin}/?auth_error=callback_failed`);
}
