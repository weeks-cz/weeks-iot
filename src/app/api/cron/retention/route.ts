import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { retentionCutoffIso } from "@/lib/retention";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Vždy projekt Učebny (kde žije learning_events) — repo historicky drží
  // v SUPABASE_URL hub projekt, proto URL bereme z NEXT_PUBLIC_SUPABASE_URL.
  // SUPABASE_SERVICE_ROLE_KEY musí být service klíč projektu Učebny.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const supabase = createClient(url, key);
  // Denní běh je zároveň keep-alive: dotyk DB brání auto-pauze free tieru
  // Supabase (~7 dní neaktivity). Mazání je idempotentní.
  const cutoff = retentionCutoffIso(new Date());
  const { error, count } = await supabase
    .from("learning_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count ?? 0, cutoff });
}
