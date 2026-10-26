"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { activeNavHref, CHILD_NAV } from "../nav";

/**
 * Domů · Kurzy · Sbírka uprostřed tmavé hlavičky.
 *
 * Na klientovi kvůli `usePathname`: layout se při přechodu mezi stránkami
 * znovu nevykresluje, takže by aktivní položku ze serveru nechal starou.
 * Pod 640 px se schová a stejné položky nabídne menu pod avatarem.
 */
export function NavLinks() {
  const active = activeNavHref(usePathname());

  return (
    <nav aria-label="Učebna" className="hidden items-center gap-6 sm:flex">
      {CHILD_NAV.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-sm border-b-2 text-[15px] font-medium transition-colors",
              isActive
                ? "border-paper text-paper"
                : "border-transparent text-paper/60 hover:text-paper",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
