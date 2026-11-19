"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EVENT, track } from "@/features/analytics/track";
import { cn } from "@/lib/cn";
import { DeviceLinkForm, type DeviceVariant } from "./DeviceLinkForm";

/* ── Rozpoznání zařízení ──────────────────────────────────────────────────
   Podle hlavního ukazatele, ne podle user agentu: `pointer: coarse` je prst
   (telefon, tablet), jinak myš nebo touchpad. Vestavěný prohlížeč Facebooku
   nebo Instagramu se tím pozná taky, user agent by ho musel vyjmenovat. */

const QUERY = "(pointer: coarse)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}

function detect(): DeviceVariant {
  if (typeof window.matchMedia !== "function") return "mobile";
  return window.matchMedia(QUERY).matches ? "mobile" : "desktop";
}

/* Server zařízení nezná. `null` = zatím nerozhodnuto, vykreslí se varianta
   pro telefon (odtud chodí většina provozu z reklamy) a nic se neměří. */
const unknownOnServer = (): DeviceVariant | null => null;

/**
 * Blok pod nadpisem `/pro-rodice`: formulář a cesta rovnou do lekce.
 *
 * Telefon: nahoře formulář „Pošleme vám odkaz“, pod ním nenápadný odkaz
 * „Přesto zkusit na telefonu“ – telefon se nesmí zablokovat.
 * Počítač: nahoře „Začít první lekci“, formulář pod ním jako druhá možnost.
 *
 * Obojí je v HTML ze serveru. Skript po hydrataci jen prohodí pořadí,
 * nadpis formuláře a podobu odkazu; nic se neodkrývá až skriptem.
 */
export function DeviceOrder({ lessonHref }: { lessonHref: string }) {
  const detected = useSyncExternalStore(subscribe, detect, unknownOnServer);
  const variant: DeviceVariant = detected ?? "mobile";
  const desktop = variant === "desktop";

  function onLessonClick() {
    void track(EVENT.PARENT_PAGE_LESSON_CLICK, {
      placement: desktop ? "primary" : "phone_anyway",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={cn(desktop ? "order-2" : "order-1")}>
        <DeviceLinkForm variant={variant} trackView={detected !== null} />
      </div>

      <div className={cn(desktop ? "order-1" : "order-2", !desktop && "text-center")}>
        {desktop ? (
          <ButtonLink href={lessonHref} size="lg" onClick={onLessonClick}>
            Začít první lekci
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </ButtonLink>
        ) : (
          <Link
            href={lessonHref}
            onClick={onLessonClick}
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-paper underline decoration-paper/40 underline-offset-4 hover:decoration-paper"
          >
            Přesto zkusit na telefonu
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
