import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

/** Cesty, na které se nedostane nepřihlášený návštěvník. */
const PROTECTED_PREFIXES = ["/ucet", "/ucim-se"];

/** Cesty, které přihlášenému rodiči nedávají smysl. */
const GUEST_ONLY_PREFIXES = ["/prihlaseni", "/registrace"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

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

  if (!user && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/prihlaseni";
    url.search = "";
    /* Kam se vrátit po přihlášení. Ukládá se jen cesta v rámci aplikace —
       ověří ji ještě isSafeNextPath v callbacku, ať se z toho nedá udělat
       otevřené přesměrování. */
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (user && matchesPrefix(pathname, GUEST_ONLY_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/ucet";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
