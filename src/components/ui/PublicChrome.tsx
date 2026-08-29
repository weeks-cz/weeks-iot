import Link from "next/link";
import { ButtonLink } from "./Button";
import { Logo } from "./Logo";
import { CONTROLLER, SITE } from "@/lib/site";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/15 bg-paper/95 backdrop-blur">
      <div className="section-container flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Hlavní" className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/prihlaseni"
            className="rounded-sm px-2 py-1 text-sm font-semibold text-ink-500 hover:text-ink"
          >
            Přihlásit
          </Link>
          <ButtonLink href="/kurz/iot" size="sm">
            Zkusit zdarma
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-ink/15 bg-paper-soft">
      <div className="section-container flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 font-mono text-xs text-ink-500">
            {CONTROLLER.name}, IČO {CONTROLLER.ico}
          </p>
        </div>

        <nav aria-label="Právní informace" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a
            href={CONTROLLER.termsUrl}
            className="text-ink-500 underline underline-offset-4 hover:text-ink"
          >
            Podmínky užití
          </a>
          <a
            href={CONTROLLER.privacyUrl}
            className="text-ink-500 underline underline-offset-4 hover:text-ink"
          >
            Ochrana údajů
          </a>
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="text-ink-500 underline underline-offset-4 hover:text-ink"
          >
            {SITE.supportEmail}
          </a>
        </nav>
      </div>
    </footer>
  );
}
