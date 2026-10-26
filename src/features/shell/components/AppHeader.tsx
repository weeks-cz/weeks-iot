import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { HeaderCta } from "@/components/ui/HeaderCta";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import { homeHref, type Viewer } from "../home-href";
import { AnonHomeLink } from "./AnonHomeLink";
import { AvatarMenu } from "./AvatarMenu";
import { NavLinks } from "./NavLinks";

/**
 * Hlavička učebny — jedna pro všechno.
 *
 * `dark` (výchozí) je aplikace: dětská část, přehled kurzu, lekce.
 * `light` je úvodní a právní stránky; tam stačí logo a jedna cesta dál —
 * přihlášenému „Do učebny“, anonymovi „Přihlásit“. Pravidla, kam vede logo
 * a co je vpravo, jsou tak na jednom místě a dvě hlavičky se nemůžou
 * rozejít.
 *
 * Server component bez vlastního načítání: viewera dodá volající
 * (`getViewer()`), takže jde vykreslit i v testu.
 */
export function AppHeader({
  viewer,
  tone = "dark",
  inLesson = false,
}: {
  viewer: Viewer;
  tone?: "dark" | "light";
  /** V lekci se amber „Zkusit zdarma“ neukazuje (viz `HeaderCta`). */
  inLesson?: boolean;
}) {
  const dark = tone === "dark";
  const home = homeHref(viewer);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b",
        dark ? "border-paper/10 bg-ink text-paper" : "border-ink/15 bg-paper/95 backdrop-blur",
      )}
    >
      <div className="section-container flex h-16 items-center justify-between gap-4">
        {viewer.kind === "anon" ? (
          <AnonHomeLink initialHref={home} dark={dark} />
        ) : (
          <Logo href={home} dark={dark} mark />
        )}

        {dark && viewer.kind === "child" && <NavLinks />}

        <RightSide viewer={viewer} dark={dark} inLesson={inLesson} />
      </div>
    </header>
  );
}

function RightSide({ viewer, dark, inLesson }: { viewer: Viewer; dark: boolean; inLesson: boolean }) {
  const quiet = cn(
    "inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-semibold transition-colors",
    dark ? "text-paper/70 hover:text-paper" : "text-ink-500 hover:text-ink",
  );

  if (viewer.kind === "anon") {
    return (
      <nav aria-label="Hlavní" className="flex items-center gap-2 sm:gap-4">
        <Link href="/prihlaseni" className={quiet}>
          Přihlásit
        </Link>
        {!inLesson && <HeaderCta />}
      </nav>
    );
  }

  /* Úvodní a právní stránky: přihlášený nepotřebuje nic než cestu zpátky. */
  if (!dark) {
    return (
      <ButtonLink href="/ucim-se" variant="secondary" size="sm">
        Do učebny →
      </ButtonLink>
    );
  }

  if (viewer.kind === "parent") {
    return (
      <nav aria-label="Účet" className="flex items-center gap-1 sm:gap-3">
        <Link
          href="/ucim-se/prepnout"
          className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-semibold text-paper underline underline-offset-4 hover:text-accent-200"
        >
          Vybrat profil
        </Link>
        <Link href="/ucet" className={quiet}>
          Účet rodiče
        </Link>
      </nav>
    );
  }

  return <AvatarMenu nick={viewer.nick} avatar={viewer.avatar} />;
}
