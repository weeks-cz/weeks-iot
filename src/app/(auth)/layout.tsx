import type { Metadata } from "next";

/**
 * Auth zóna se neindexuje.
 *
 * Přihlašovací a registrační stránky nemají v hledání co dělat — nesou
 * nulovou informační hodnotu a přetahovaly by pozice veřejným stránkám
 * kurzu, na kterých stojí akvizice.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
