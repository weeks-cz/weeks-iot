"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EVENT, track } from "@/features/analytics/track";
import { DeviceLinkForm } from "./DeviceLinkForm";

/**
 * Blok pod nadpisem `/pro-rodice`: formulář a cesta rovnou do lekce.
 *
 * Telefon: nahoře formulář „Pošleme vám odkaz“, pod ním nenápadný odkaz
 * „Přesto zkusit na telefonu“ – telefon se nesmí zablokovat.
 * Počítač (`pointer: fine`): nahoře „Začít první lekci“, formulář pod ním
 * jako druhá možnost.
 *
 * O pořadí i textech rozhoduje CSS (`pointer-fine:`), ne skript. HTML ze
 * serveru je tak správně na obou zařízeních hned, bez prohazování po
 * hydrataci, a funguje i bez JavaScriptu. Zařízení bez ukazatele dostane
 * podobu pro telefon. Klientská komponenta je to jen kvůli měření kliků.
 */
export function DeviceOrder({ lessonHref }: { lessonHref: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="order-1 pointer-fine:order-2">
        <DeviceLinkForm variant="auto" />
      </div>

      <div className="order-2 pointer-fine:order-1">
        <div className="text-center pointer-fine:hidden">
          <Link
            href={lessonHref}
            onClick={() => void track(EVENT.PARENT_PAGE_LESSON_CLICK, { placement: "phone_anyway" })}
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-paper underline decoration-paper/40 underline-offset-4 hover:decoration-paper"
          >
            Přesto zkusit na telefonu
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="hidden pointer-fine:block">
          <ButtonLink
            href={lessonHref}
            size="lg"
            onClick={() => void track(EVENT.PARENT_PAGE_LESSON_CLICK, { placement: "primary" })}
          >
            Začít první lekci
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
