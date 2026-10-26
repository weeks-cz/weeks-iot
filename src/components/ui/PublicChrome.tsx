import Link from "next/link";
import { Logo } from "./Logo";
import { CONTROLLER, SITE } from "@/lib/site";
import { CookieSettingsButton } from "@/features/cookies/CookieSettingsButton";
import { AppHeader } from "@/features/shell/components/AppHeader";
import { HeaderByPath } from "@/features/shell/components/HeaderByPath";
import { getViewer } from "@/features/shell/queries";

/**
 * Hlavička veřejné zóny.
 *
 * Musí znát session: přihlášené dítě v lekci má vidět svou hlavičku
 * (logo do lobby, navigaci, menu pod avatarem), ne marketingové
 * „Přihlásit“. Obě varianty jsou `AppHeader`; kterou ukázat, rozhoduje
 * cesta na klientovi (viz `HeaderByPath`).
 *
 * Čtení session dělá stránky veřejné zóny dynamickými. Kurz a lekce
 * session četly už dřív; úvodní stránka tím přichází o statické
 * vykreslení s revalidací.
 */
export async function PublicHeader() {
  const viewer = await getViewer();
  return (
    <HeaderByPath
      app={<AppHeader viewer={viewer} />}
      site={<AppHeader viewer={viewer} tone="light" />}
    />
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
          <Link href="/podminky" className="text-ink-500 underline underline-offset-4 hover:text-ink">
            Podmínky užití
          </Link>
          <Link
            href="/ochrana-udaju"
            className="text-ink-500 underline underline-offset-4 hover:text-ink"
          >
            Ochrana údajů
          </Link>
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="text-ink-500 underline underline-offset-4 hover:text-ink"
          >
            {SITE.supportEmail}
          </a>
          <CookieSettingsButton />
        </nav>
      </div>
    </footer>
  );
}
