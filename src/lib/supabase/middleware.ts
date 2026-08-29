import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import { decideAccess } from "@/features/auth/route-access";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  /* getUser() musí běžet na každém požadavku — je to jediné místo, kde se
     obnoví vypršený token. Bez něj se uživatel po hodině tiše odhlásí.
     getSession() tady nestačí: čte cookie bez ověření podpisu. */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  const decision = decideAccess(pathname, Boolean(user));

  if (decision.action === "toLogin") {
    const url = request.nextUrl.clone();
    url.pathname = "/prihlaseni";
    url.search = "";
    /* Kam se vrátit po přihlášení. Ukládá se jen cesta v rámci aplikace —
       ověří ji ještě isSafeNextPath v callbacku, ať se z toho nedá udělat
       otevřené přesměrování. */
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (decision.action === "toAccount") {
    const url = request.nextUrl.clone();
    url.pathname = "/ucet";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
