"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BookOpen,
  ChevronDown,
  House,
  LogOut,
  Package,
  Smile,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/features/auth/actions";
import { Avatar } from "@/features/children/avatars";
import { activeNavHref, CHILD_NAV } from "../nav";

const NAV_ICONS = { "/ucim-se": House, "/kurz/iot": BookOpen, "/ucim-se/sbirka": Package } as const;

/* min-h-11 drží dotykový cíl na 44 px. */
const ITEM =
  "flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-semibold " +
  "outline-none hover:bg-paper-soft focus-visible:bg-paper-soft";

/** Položky menu, které jsou opravdu vidět (navigace je nad 640 px skrytá). */
function visibleItems(menu: HTMLElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(
    (el) => el.getClientRects().length > 0,
  );
}

/**
 * Menu pod avatarem.
 *
 * Jediná cesta z dětské části do účtu rodiče a k odhlášení — proto musí
 * jít celé ovládat klávesnicí: šipky mezi položkami, Esc zavře a vrátí
 * fokus na avatar, Tab menu opustí. Klik mimo zavře. Na telefonu nese
 * i navigaci (Domů · Kurzy · Sbírka), kterou hlavička pod 640 px schová.
 */
export function AvatarMenu({ nick, avatar }: { nick: string; avatar: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const active = activeNavHref(usePathname());

  useEffect(() => {
    if (!open) return;
    /* Vzor „menu button“: po otevření jde fokus na první položku. */
    visibleItems(menuRef.current)[0]?.focus();

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close({ returnFocus }: { returnFocus: boolean }) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!open) {
      if (event.key === "ArrowDown" && event.target === triggerRef.current) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close({ returnFocus: true });
      return;
    }
    /* Tab menu opustí a fokus jde přirozeně dál; otevřené by jen viselo. */
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    const items = visibleItems(menuRef.current);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const move: Record<string, number> = {
      ArrowDown: current < 0 ? 0 : (current + 1) % items.length,
      ArrowUp: current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    const target = move[event.key];
    if (target === undefined) return;
    event.preventDefault();
    items[target]?.focus();
  }

  const onItemClick = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 rounded-md px-1.5 font-semibold text-paper
                   transition-colors hover:bg-paper/10
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
      >
        {/* Avatar je linková kresba v currentColor — na tmavé hlavičce by
            zanikl, proto světlý kruh pod ním. */}
        <Avatar
          id={avatar}
          className="block size-9 shrink-0 rounded-full border-2 border-paper bg-paper p-1 text-ink"
        />
        <span className="max-w-36 truncate">{nick}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 opacity-60 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={nick}
          className="absolute right-0 top-full z-50 mt-2 w-64 border-2 border-ink bg-white text-ink shadow-hard"
        >
          <p
            role="none"
            className="truncate border-b border-ink/10 bg-paper-soft px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-ink-500"
          >
            {nick}
          </p>

          <div role="none" className="border-b border-ink/10 sm:hidden">
            {CHILD_NAV.map((item) => {
              const Icon = NAV_ICONS[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  aria-current={item.href === active ? "page" : undefined}
                  onClick={onItemClick}
                  className={cn(ITEM, item.href === active && "underline underline-offset-4")}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-ink-500" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <Link href="/ucim-se/avatar" role="menuitem" onClick={onItemClick} className={ITEM}>
            <Smile aria-hidden="true" className="size-4 shrink-0 text-ink-500" />
            Změnit avatar
          </Link>
          <Link href="/ucim-se/prepnout" role="menuitem" onClick={onItemClick} className={ITEM}>
            <ArrowLeftRight aria-hidden="true" className="size-4 shrink-0 text-ink-500" />
            Přepnout profil
          </Link>
          <Link
            href="/ucet"
            role="menuitem"
            onClick={onItemClick}
            className={cn(ITEM, "border-b border-ink/10")}
          >
            <UserRound aria-hidden="true" className="size-4 shrink-0 text-ink-500" />
            Účet rodiče
          </Link>
          <form action={signOutAction} role="none">
            <button type="submit" role="menuitem" className={cn(ITEM, "text-ink-500")}>
              <LogOut aria-hidden="true" className="size-4 shrink-0" />
              Odhlásit
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
