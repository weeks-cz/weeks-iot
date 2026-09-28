import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * `unsafe-inline` u stylů je u Tailwindu a next/font nevyhnutelné — obojí
 * injektuje inline <style>. U skriptů je `unsafe-inline` potřeba kvůli
 * bootstrap skriptu Next.js; `unsafe-eval` jen ve vývoji kvůli React Refresh.
 *
 * connect-src musí pustit Supabase (REST i realtime přes wss).
 * img-src pouští weeks.cz kvůli pozadí zamrazeného táborového režimu.
 */
function buildCsp(): string {
  const dev = process.env.NODE_ENV === "development";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabase.replace(/^https:/, "wss:");

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://weeks.cz",
    `connect-src 'self' ${supabase} ${supabaseWs}`.trim(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  /* Certifikát (src/features/certificates/pdf.tsx) čte písmo z disku.
     Trasování souborů ho samo nenajde — cesta se skládá za běhu — takže
     bez tohohle by PDF lokálně fungovalo a na Vercelu spadlo. Vystavuje
     se z více cest (zápis lekce, registrace, účet), proto všude; jsou to
     dva soubory po 90 kB. */
  outputFileTracingIncludes: {
    "/**": ["./src/features/certificates/fonts/**"],
  },
  /* react-pdf a jeho fontkit se nemají bundlovat — sahají na Node API
     a v bundlu se rozbíjí jejich dynamické načítání. */
  serverExternalPackages: ["@react-pdf/renderer"],
  trailingSlash: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: buildCsp() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
