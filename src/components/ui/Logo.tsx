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
  className,
}: {
  href?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-baseline gap-2 rounded-sm", className)}
      aria-label="Weeks Učebna — domů"
    >
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
          dark ? "text-accent-300 group-hover:text-accent-200" : "text-primary-600 group-hover:text-primary-700",
        )}
      >
        Učebna
      </span>
    </Link>
  );
}
