/**
 * Navigace dítěte v hlavičce.
 *
 * „Kurzy“ míří rovnou na jediný kurz, dokud je jeden. Sdílí ji
 * `NavLinks` (desktop) i `AvatarMenu` (telefon), aby se nerozešly.
 */
export const CHILD_NAV = [
  { href: "/ucim-se", label: "Domů" },
  { href: "/kurz/iot", label: "Kurzy" },
  { href: "/ucim-se/sbirka", label: "Sbírka" },
] as const;

/**
 * Která položka je aktivní.
 *
 * Domů jen na samotném lobby — sbírka i výběr profilu leží pod
 * `/ucim-se`, a kdyby stačil prefix, svítily by dvě položky naráz.
 * Kurzy svítí na přehledu kurzu i v lekci. `trailingSlash: true`
 * v next.config znamená, že cesta může končit lomítkem.
 */
export function activeNavHref(pathname: string | null): string | null {
  if (!pathname) return null;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (path === "/ucim-se") return "/ucim-se";
  if (path === "/ucim-se/sbirka" || path.startsWith("/ucim-se/sbirka/")) return "/ucim-se/sbirka";
  if (path === "/kurz" || path.startsWith("/kurz/")) return "/kurz/iot";
  return null;
}
