/**
 * Soft origin gate pro API routes (stejná logika jako /api/notify-account).
 * Není to bezpečnostní hranice — útočník hlavičku zfalšuje — ale odřízne
 * drive-by boty a scannery bez Origin hlavičky z prohlížeče.
 */

const ALLOWED_HOSTS = [
  /\.weeks\.cz$/,
  /^weeks\.cz$/,
  /^localhost(:\d+)?$/,
  /^127\.0\.0\.1(:\d+)?$/,
  /^weeks-iot(-[\w-]+)*\.vercel\.app$/,
];

export function isAllowedHost(host: string): boolean {
  return ALLOWED_HOSTS.some((re) => re.test(host));
}

export function isAllowedOrigin(originHeader: string | null): boolean {
  // Žádná Origin hlavička → přijmout (server-to-server, healthchecky).
  // Reálný abuse vektor jsou browser POSTy, které Origin vždy nesou.
  if (!originHeader) return true;
  try {
    return isAllowedHost(new URL(originHeader).host);
  } catch {
    return false;
  }
}
