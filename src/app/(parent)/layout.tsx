import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { signOutAction } from "@/features/auth/actions";
import { getSession } from "@/features/account/session";
import { voiceFor } from "@/features/account/voice";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  /* Middleware sem nepřihlášeného nepustí, ale layout si to ověřuje sám.
     Autorizace se nemá spoléhat na jedinou vrstvu — kdyby se změnil
     matcher middlewaru, tahle zóna by se tiše otevřela.

     getSession() je cachovaná v rámci jednoho vykreslení, takže totéž
     volání ve stránce pod tímhle layoutem už nic nestojí. */
  const session = await getSession();
  if (!session) redirect("/prihlaseni?next=%2Fucet");

  const parent = session.account;
  if (!parent?.onboarding_completed_at) redirect("/registrace/onboarding");

  const voice = voiceFor(parent.account_type);
  const nav = [
    { href: "/ucet", label: voice.nav.overview },
    { href: "/ucet/deti", label: voice.nav.profiles },
    { href: "/ucet/souhlasy", label: voice.nav.consents },
  ];

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-ink/15 bg-white">
        <div className="section-container flex h-16 items-center justify-between gap-4">
          <Logo href="/ucet" />

          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-sm px-2 py-1 text-sm text-ink-500 underline underline-offset-4 hover:text-ink"
            >
              Odhlásit
            </button>
          </form>
        </div>

        <nav aria-label="Rodičovská sekce" className="section-container">
          {/* Vodorovný posun místo zalomení: na úzkém telefonu se tři
              položky do řádku nevejdou a zalomená navigace by odsunula
              obsah pod ohyb. */}
          <ul className="-mb-px flex gap-1 overflow-x-auto">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block whitespace-nowrap border-b-2 border-transparent px-3 py-3
                             text-sm font-semibold text-ink-500 transition-colors
                             hover:border-ink/30 hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="section-container py-8">{children}</main>

      <footer className="section-container border-t border-ink/10 py-6">
        <p className="font-mono text-xs text-ink-300">
          Přihlášen jako {session.email}
        </p>
      </footer>
    </div>
  );
}
