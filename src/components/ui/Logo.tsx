import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Značka.
 *
 * Učebna jede pod značkou Weeks — samostatná značka má podle plánu spouštěč
 * až u brány 3 a jen s daty. „Učebna" je proto popisek za názvem, ne druhé
 * logo.
 */
export function Logo({
  href = "/",
  dark,
  mark = false,
  className,
}: {
  href?: string;
  dark?: boolean;
  /** Přidá před název logo W (výška 24 px). */
  mark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-baseline gap-2 rounded-sm", className)}
      aria-label="Weeks Učebna — domů"
    >
      {mark && (
        // Dekorace vedle textu „Weeks“, proto prázdné alt. Soubor je 2× (96 px).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/brand/weeks-w.png"
          alt=""
          width={36}
          height={24}
          className="h-6 w-auto self-center"
        />
      )}
      <span
        className={cn(
          "font-display text-xl font-bold tracking-tight",
          dark ? "text-paper" : "text-ink",
        )}
      >
        Weeks
      </span>
      <span
        className={cn(
          "font-mono text-xs uppercase tracking-[0.2em] transition-colors",
          /* S logem W se na úzkém telefonu popisek nevejde vedle „Přihlásit“
             a „Zkusit zdarma“; značku nese W a „Weeks“. */
          mark && "max-[399px]:hidden",
          dark ? "text-accent-300 group-hover:text-accent-200" : "text-primary-600 group-hover:text-primary-700",
        )}
      >
        Učebna
      </span>
    </Link>
  );
}
